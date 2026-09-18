"""
Batch Processor for 14GB GeoTIFF Orthomosaic
Extracts multi-sector survey zones, calculates real WGS84 geotransforms from embedded UTM tags,
runs bund detection per sector, and compiles a merged master cadastral GeoJSON.
"""

import os
import sys
import json
import cv2
import numpy as np
import tifffile
from pyproj import Transformer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.pipeline.pipeline_runner import BundDetectionPipeline

TIF_PATH = r"C:\Users\nisha\Downloads\SF5, SF6.tif"
SAMPLES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")
os.makedirs(SAMPLES_DIR, exist_ok=True)


def batch_process():
    print("=" * 60)
    print("BATCH PROCESSING 14GB GEOTIFF SURVEY DATASET")
    print(f"File: {TIF_PATH}")
    print("=" * 60)

    if not os.path.exists(TIF_PATH):
        print(f"Error: File not found at {TIF_PATH}")
        sys.exit(1)

    with tifffile.TiffFile(TIF_PATH) as tif:
        p0 = tif.pages[0]
        dx_m = float(p0.tags['ModelPixelScaleTag'].value[0])
        dy_m = float(p0.tags['ModelPixelScaleTag'].value[1])
        origin_utm_x = float(p0.tags['ModelTiepointTag'].value[3])
        origin_utm_y = float(p0.tags['ModelTiepointTag'].value[4])

        print(f"Base GSD: {dx_m * 100:.2f} cm/pixel")
        print(f"UTM Origin: X={origin_utm_x:.2f}, Y={origin_utm_y:.2f} (UTM Zone 43N)")

        # Transformer to WGS84
        to_wgs84 = Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True)

        # We extract from Pyramid Page 3 (10082 x 7728, 8x downsampled)
        # GSD for Page 3 is dx_m * 8 = 42.24 cm/pixel
        p3 = tif.pages[3]
        scale_factor = 8
        page_gsd_cm = dx_m * scale_factor * 100.0  # 42.24 cm/px
        page_gsd_m = dx_m * scale_factor

        print(f"Loading Pyramid Page 3 (10082 x 7728, GSD={page_gsd_cm:.2f} cm/px)...")
        img_p3 = p3.asarray()
        h, w = img_p3.shape[:2]

        sectors = [
            {
                "id": "sector_central",
                "name": "Central Farmland Basin",
                "filename": "sector_1_central.png",
                "geojson_file": "sector_1_central.geojson",
                "cx": w // 2,
                "cy": h // 2,
                "size": 2200,
            },
            {
                "id": "sector_north",
                "name": "North Terraced Plots",
                "filename": "sector_2_north.png",
                "geojson_file": "sector_2_north.geojson",
                "cx": w // 2,
                "cy": int(h * 0.28),
                "size": 2200,
            },
            {
                "id": "sector_south",
                "name": "South Riverbed Parcels",
                "filename": "sector_3_south.png",
                "geojson_file": "sector_3_south.geojson",
                "cx": int(w * 0.45),
                "cy": int(h * 0.72),
                "size": 2200,
            },
        ]

        all_features = []
        global_parcel_id = 1
        pipeline = BundDetectionPipeline(default_gsd_cm=page_gsd_cm)

        for sec in sectors:
            print(f"\nProcessing Sector: {sec['name']} ...")
            size = sec["size"]
            x1 = max(0, sec["cx"] - size // 2)
            y1 = max(0, sec["cy"] - size // 2)
            x2 = min(w, x1 + size)
            y2 = min(h, y1 + size)

            crop = img_p3[y1:y2, x1:x2]
            if crop.shape[2] == 4:
                bgr = cv2.cvtColor(crop, cv2.COLOR_RGBA2BGR)
            else:
                bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)

            out_img_path = os.path.join(SAMPLES_DIR, sec["filename"])
            cv2.imwrite(out_img_path, bgr)
            print(f"  Saved image: {sec['filename']} ({crop.shape[1]}x{crop.shape[0]} px)")

            # Calculate real-world origin for this sector in UTM 43N
            tile_origin_utm_x = origin_utm_x + (x1 * scale_factor * dx_m)
            tile_origin_utm_y = origin_utm_y - (y1 * scale_factor * dy_m)
            tile_lon, tile_lat = to_wgs84.transform(tile_origin_utm_x, tile_origin_utm_y)

            # Reconfigure pipeline origin coordinates for this tile
            pipeline.geo_engine.origin_lat = tile_lat
            pipeline.geo_engine.origin_lon = tile_lon
            pipeline.geo_engine.default_gsd_cm = page_gsd_cm

            res = pipeline.run(out_img_path, gsd_cm=page_gsd_cm, use_ml_refinement=True)
            stats = res["stats"]
            geojson = res["parcels"]

            print(f"  Detected: {stats['parcel_count']} parcels, {stats['total_area_acres']:.2f} acres")

            # Save individual GeoJSON
            with open(os.path.join(SAMPLES_DIR, sec["geojson_file"]), "w") as f:
                json.dump(geojson, f, indent=2)

            # Re-index parcels for master dataset
            for feat in geojson["features"]:
                feat["id"] = global_parcel_id
                feat["properties"]["parcel_id"] = global_parcel_id
                feat["properties"]["sector"] = sec["name"]
                all_features.append(feat)
                global_parcel_id += 1

        # Create master merged GeoJSON
        total_sqm = sum(f["properties"]["area_sqm"] for f in all_features)
        total_acres = sum(f["properties"]["area_acres"] for f in all_features)
        master_geojson = {
            "type": "FeatureCollection",
            "properties": {
                "survey_name": "SF5, SF6 Agricultural Orthomosaic",
                "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
                "total_sectors": len(sectors),
                "total_parcels": len(all_features),
                "total_area_sqm": round(total_sqm, 2),
                "total_area_acres": round(total_acres, 4),
            },
            "features": all_features,
        }

        master_geojson_path = os.path.join(SAMPLES_DIR, "master_cadastral_survey.geojson")
        with open(master_geojson_path, "w") as f:
            json.dump(master_geojson, f, indent=2)

        # Generate Master Shapefile (.zip)
        master_shp_zip = pipeline.geo_engine.generate_shapefile_zip(master_geojson)
        master_shp_path = os.path.join(SAMPLES_DIR, "master_cadastral_survey_shapefile.zip")
        with open(master_shp_path, "wb") as f:
            f.write(master_shp_zip)

        print("\n" + "=" * 60)
        print("BATCH PROCESSING COMPLETE!")
        print(f"Total Parcels Across Sectors: {len(all_features)}")
        print(f"Total Arable Area: {total_acres:.2f} acres ({total_sqm/10000:.2f} hectares)")
        print(f"Saved Master GeoJSON: {master_geojson_path}")
        print(f"Saved Master Shapefile: {master_shp_path}")
        print("=" * 60)


if __name__ == "__main__":
    batch_process()
