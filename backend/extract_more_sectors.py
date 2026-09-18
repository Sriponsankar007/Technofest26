import os, sys, cv2, tifffile, json
import numpy as np
from pyproj import Transformer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.pipeline.pipeline_runner import BundDetectionPipeline

TIF_PATH = r"C:\Users\nisha\Downloads\SF5, SF6.tif"
SAMPLES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")

with tifffile.TiffFile(TIF_PATH) as tif:
    p0 = tif.pages[0]
    dx_m = float(p0.tags['ModelPixelScaleTag'].value[0])
    dy_m = float(p0.tags['ModelPixelScaleTag'].value[1])
    origin_utm_x = float(p0.tags['ModelTiepointTag'].value[3])
    origin_utm_y = float(p0.tags['ModelTiepointTag'].value[4])
    to_wgs84 = Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True)

    p3 = tif.pages[3]
    scale = 8
    page_gsd_cm = dx_m * scale * 100.0  # 42.24 cm/px
    img = p3.asarray()
    h, w = img.shape[:2]

    extra_sectors = [
        {
            "id": "sector_4_east",
            "name": "East Canal Irrigation (Sector 4)",
            "filename": "sector_4_east.png",
            "geojson_file": "sector_4_east.geojson",
            "cx": int(w * 0.72),
            "cy": int(h * 0.48),
            "size": 2200
        },
        {
            "id": "sector_5_west",
            "name": "West Foothill Plots (Sector 5)",
            "filename": "sector_5_west.png",
            "geojson_file": "sector_5_west.geojson",
            "cx": int(w * 0.28),
            "cy": int(h * 0.50),
            "size": 2200
        }
    ]

    pipeline = BundDetectionPipeline(default_gsd_cm=page_gsd_cm)

    for sec in extra_sectors:
        print(f"Extracting {sec['name']}...")
        size = sec["size"]
        x1 = max(0, sec["cx"] - size // 2)
        y1 = max(0, sec["cy"] - size // 2)
        x2 = min(w, x1 + size)
        y2 = min(h, y1 + size)

        crop = img[y1:y2, x1:x2]
        bgr = cv2.cvtColor(crop, cv2.COLOR_RGBA2BGR if crop.shape[2] == 4 else cv2.COLOR_RGB2BGR)
        out_img = os.path.join(SAMPLES_DIR, sec["filename"])
        cv2.imwrite(out_img, bgr)

        tile_x = origin_utm_x + (x1 * scale * dx_m)
        tile_y = origin_utm_y - (y1 * scale * dy_m)
        lon, lat = to_wgs84.transform(tile_x, tile_y)
        pipeline.geo_engine.origin_lat = lat
        pipeline.geo_engine.origin_lon = lon
        pipeline.geo_engine.default_gsd_cm = page_gsd_cm

        res = pipeline.run(out_img, gsd_cm=page_gsd_cm, use_ml_refinement=True)
        with open(os.path.join(SAMPLES_DIR, sec["geojson_file"]), "w") as f:
            json.dump(res["parcels"], f, indent=2)
        print(f"  Done: {sec['filename']} -> {res['stats']['parcel_count']} parcels, {res['stats']['total_area_acres']:.2f} acres")

print("All extra sectors extracted successfully!")
