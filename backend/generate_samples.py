"""
Sample Farmland Image Generator
Generates:
1. Synthetic farmland with exact mathematical ground-truth geometry for unit testing
2. Realistic Indian aerial farmland simulations with visible bunds, varying soil textures,
   and crop tones for hackathon presentations and live demos.
"""

import os
import cv2
import numpy as np


def generate_synthetic_farm_grid(filepath: str = "samples/synthetic_farm_grid.png"):
    """
    Creates a 1000x1000 image with 6 distinct rectangular/trapezoidal farm parcels
    separated by prominent earthen bunds (width 6px).
    At GSD = 10 cm/pixel, each pixel is 0.01 m2.
    """
    img = np.zeros((1000, 1000, 3), dtype=np.uint8)

    # Base background soil
    img[:] = (75, 110, 85)  # muted olive green

    # Define 6 distinct parcels with slightly different soil / crop tones
    parcels = [
        # (x1, y1, x2, y2, color_bgr)
        (30, 30, 480, 320, (65, 145, 95)),       # Parcel 1: lush wheat green
        (510, 30, 970, 320, (80, 120, 160)),     # Parcel 2: golden dry mustard/soil
        (30, 350, 480, 650, (50, 125, 80)),      # Parcel 3: mature sugarcane green
        (510, 350, 970, 650, (60, 100, 140)),    # Parcel 4: tilled brown earth
        (30, 680, 480, 970, (85, 160, 110)),     # Parcel 5: young gram/pulses
        (510, 680, 970, 970, (70, 135, 185)),    # Parcel 6: red loam soil
    ]

    for x1, y1, x2, y2, color in parcels:
        # Fill parcel
        cv2.rectangle(img, (x1, y1), (x2, y2), color, -1)

        # Add subtle inner crop texture (fine soil texture variation)
        noise = np.random.normal(0, 3, (y2 - y1, x2 - x1, 3)).astype(np.int16)
        patch = np.clip(img[y1:y2, x1:x2].astype(np.int16) + noise, 0, 255).astype(np.uint8)
        img[y1:y2, x1:x2] = patch

    # Draw raised earthen bunds (embankment ridges) with light ridge and dark shadow
    bund_lines = [
        # Vertical bunds
        ((495, 20), (495, 980)),
        # Horizontal bunds
        ((20, 335), (980, 335)),
        ((20, 665), (980, 665)),
        # Outer boundary bunds
        ((20, 20), (980, 20)),
        ((20, 980), (980, 980)),
        ((20, 20), (20, 980)),
        ((980, 20), (980, 980)),
    ]

    for pt1, pt2 in bund_lines:
        # Shadow side of bund (dark brown)
        cv2.line(img, (pt1[0] + 2, pt1[1] + 2), (pt2[0] + 2, pt2[1] + 2), (30, 45, 50), 4)
        # Highlight crest of bund (light dry silt)
        cv2.line(img, pt1, pt2, (110, 160, 185), 3)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    cv2.imwrite(filepath, img)
    print(f"Generated synthetic farm grid at: {filepath}")
    return filepath


def generate_realistic_aerial_farmland(filepath: str = "samples/maharashtra_paddy_bunds.png"):
    """
    Simulates high-resolution drone orthomosaic of Indian agricultural landscape
    with 9 irregular, terraced field parcels, organic bund contours, irrigation channels,
    and realistic soil variation.
    """
    np.random.seed(101)
    w, h = 1200, 900
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # Soil background
    img[:] = (70, 95, 80)

    # Create irregular organic field regions
    field_polygons = [
        # Field 1 (top-left)
        np.array([[40, 40], [380, 35], [410, 280], [30, 290]], np.int32),
        # Field 2 (top-center)
        np.array([[410, 35], [790, 45], [820, 270], [430, 280]], np.int32),
        # Field 3 (top-right)
        np.array([[810, 45], [1160, 40], [1155, 290], [840, 270]], np.int32),
        # Field 4 (mid-left)
        np.array([[30, 315], [410, 305], [430, 580], [45, 595]], np.int32),
        # Field 5 (center paddy)
        np.array([[435, 305], [820, 295], [800, 570], [450, 580]], np.int32),
        # Field 6 (mid-right)
        np.array([[840, 295], [1155, 315], [1145, 600], [825, 575]], np.int32),
        # Field 7 (bottom-left)
        np.array([[45, 620], [430, 605], [410, 860], [50, 855]], np.int32),
        # Field 8 (bottom-center)
        np.array([[450, 605], [800, 595], [785, 860], [435, 860]], np.int32),
        # Field 9 (bottom-right)
        np.array([[825, 600], [1145, 625], [1150, 860], [810, 860]], np.int32),
    ]

    colors = [
        (65, 140, 80),    # Emerald paddy
        (85, 170, 110),   # Light green sprouts
        (90, 130, 175),   # Brown dry fallow
        (60, 115, 70),    # Dark crop
        (75, 155, 95),    # Vibrant crop
        (95, 140, 185),   # Dry clay
        (70, 130, 85),    # Green pulses
        (65, 120, 75),    # Deep green
        (100, 150, 195),  # Sandy loam
    ]

    for poly, color in zip(field_polygons, colors):
        cv2.fillPoly(img, [poly], color)

        # Draw realistic agricultural furrows inside polygon
        rect = cv2.boundingRect(poly)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [poly], 255)

        for y in range(rect[1] + 8, rect[1] + rect[3] - 8, 10):
            furrow_col = tuple(max(0, c - 18) for c in color)
            line_img = np.zeros((h, w, 3), dtype=np.uint8)
            cv2.line(line_img, (rect[0], y), (rect[0] + rect[2], y), furrow_col, 1)
            img[mask == 255] = np.where(
                line_img[mask == 255] > 0, line_img[mask == 255], img[mask == 255]
            )

    # Trace realistic bunds between all polygons
    bund_overlay = np.zeros_like(img)
    for poly in field_polygons:
        # Shadow pass (deep umber/black shadow from bund slope)
        cv2.polylines(img, [poly], isClosed=True, color=(35, 45, 40), thickness=6, lineType=cv2.LINE_AA)
        # Ridge crest pass (sunlit earthen ridge)
        cv2.polylines(img, [poly], isClosed=True, color=(145, 175, 190), thickness=3, lineType=cv2.LINE_AA)

    # Add subtle Gaussian noise to simulate drone sensor grain
    noise = np.random.normal(0, 4, img.shape).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    cv2.imwrite(filepath, img)
    print(f"Generated realistic aerial farmland at: {filepath}")
    return filepath


if __name__ == "__main__":
    generate_synthetic_farm_grid()
    generate_realistic_aerial_farmland()
