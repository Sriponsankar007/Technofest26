"""
Extracts a high-density farm plot crop from Pyramid Page 3 (10082 x 7728)
covering ~176 acres of actual farm plots with clear bund ridges.
"""

import os
import cv2
import tifffile
from pyproj import Transformer

TIF_PATH = r"C:\Users\nisha\Downloads\SF5, SF6.tif"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "samples", "real_farmland_dense_plots.png")

with tifffile.TiffFile(TIF_PATH) as tif:
    print("Reading Pyramid Page 3 (approx 10082 x 7728)...")
    p3 = tif.pages[3]
    arr3 = p3.asarray()
    print(f"Page 3 loaded with shape: {arr3.shape}")

    # Crop a 2000x2000 agricultural section with active plots
    h, w = arr3.shape[:2]
    cy, cx = h // 2, w // 2
    crop = arr3[cy - 1000 : cy + 1000, cx - 1000 : cx + 1000]

    # Convert RGBA to BGR
    if crop.shape[2] == 4:
        crop_bgr = cv2.cvtColor(crop, cv2.COLOR_RGBA2BGR)
    else:
        crop_bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)

    cv2.imwrite(OUTPUT_PATH, crop_bgr)
    print(f"Successfully saved dense farm crop to: {OUTPUT_PATH}")

    # GSD for Page 3 is 8x the base GSD (5.2805 cm * 8 = 42.24 cm/px)
    gsd_cm = 5.28047 * 8
    print(f"GSD for this tile: {gsd_cm:.2f} cm/pixel")
    print(f"Ground footprint: {2000 * gsd_cm / 100:.1f}m x {2000 * gsd_cm / 100:.1f}m")
    print(f"Total acreage: {(2000 * gsd_cm / 100)**2 / 4046.856:.2f} acres")
