"""
Real GeoTIFF Tile & Overview Extractor
Extracts:
1. A full-resolution 2000x2000 farm tile from the center of the 14GB orthomosaic (at native 5.28 cm/px)
2. A balanced overview from Page 5 of the pyramid for full-survey mapping
Preserves exact real-world WGS84 coordinates.
"""

import os
import cv2
import numpy as np
import tifffile
from pyproj import Transformer

TIF_PATH = r"C:\Users\nisha\Downloads\SF5, SF6.tif"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "samples")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def extract_sample_tiles():
    print(f"Opening GeoTIFF: {TIF_PATH} ...")
    with tifffile.TiffFile(TIF_PATH) as tif:
        # 1. Extract Overview from Page 5 (approx 2521 x 1932)
        print("Extracting full-survey overview from Pyramid Page 5...")
        overview_page = tif.pages[5]
        overview_arr = overview_page.asarray()
        # Drop alpha channel if present (RGBA -> RGB)
        if overview_arr.shape[2] == 4:
            overview_rgb = cv2.cvtColor(overview_arr, cv2.COLOR_RGBA2BGR)
        else:
            overview_rgb = cv2.cvtColor(overview_arr, cv2.COLOR_RGB2BGR)

        overview_path = os.path.join(OUTPUT_DIR, "survey_overview_full.png")
        cv2.imwrite(overview_path, overview_rgb)
        print(f"Saved overview ({overview_rgb.shape[1]}x{overview_rgb.shape[0]}) to {overview_path}")

        # 2. Extract Full-Resolution Crop from Page 0 (center 2500 x 2500)
        # Using memory-mapped zarr/asarray window to avoid loading 14GB
        print("Extracting high-density farm plot tile from Page 0 at 100% native resolution (5.28 cm/px)...")
        # Center coordinates
        full_h, full_w = tif.pages[0].shape[:2]
        crop_size = 2500
        y_start = full_h // 2 - crop_size // 2
        x_start = full_w // 2 - crop_size // 2

        # Memory-mapped read of just this tile
        z = tif.pages[0].asarray(out='memmap')
        tile_arr = z[y_start : y_start + crop_size, x_start : x_start + crop_size]

        if tile_arr.shape[2] == 4:
            tile_bgr = cv2.cvtColor(tile_arr, cv2.COLOR_RGBA2BGR)
        else:
            tile_bgr = cv2.cvtColor(tile_arr, cv2.COLOR_RGB2BGR)

        tile_path = os.path.join(OUTPUT_DIR, "real_drone_farm_tile_2500px.png")
        cv2.imwrite(tile_path, tile_bgr)
        print(f"Saved native resolution farm tile ({crop_size}x{crop_size}) to {tile_path}")

        # 3. Calculate real-world coordinates for this tile
        p0 = tif.pages[0]
        dx = p0.tags['ModelPixelScaleTag'].value[0]
        dy = p0.tags['ModelPixelScaleTag'].value[1]
        origin_x = p0.tags['ModelTiepointTag'].value[3]
        origin_y = p0.tags['ModelTiepointTag'].value[4]

        tile_utm_x = origin_x + (x_start * dx)
        tile_utm_y = origin_y - (y_start * dy)

        trans = Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True)
        tile_lon, tile_lat = trans.transform(tile_utm_x, tile_utm_y)

        print("\n=== EXTRACTED TILE METADATA ===")
        print(f"Tile Path: {tile_path}")
        print(f"Native Resolution (GSD): {dx * 100:.2f} cm/pixel")
        print(f"Ground Area Covered: {crop_size * dx:.1f} m x {crop_size * dy:.1f} m")
        print(f"Tile Acreage: {(crop_size * dx * crop_size * dy) / 4046.856:.2f} acres")
        print(f"Real World Coordinates (WGS84): Lat {tile_lat:.6f}, Lon {tile_lon:.6f}")


if __name__ == "__main__":
    extract_sample_tiles()
