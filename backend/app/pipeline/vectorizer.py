"""
Polygon Vectorization Module
Extracts contours from labeled parcel masks, simplifies them via Douglas-Peucker,
and guarantees topologically valid Shapely polygons.
"""

from typing import List, Dict, Any, Tuple
import cv2
import numpy as np
from shapely.geometry import Polygon, MultiPolygon
from shapely.validation import make_valid


class ParcelVectorizer:
    def __init__(self, simplify_tolerance_px: float = 2.0):
        self.simplify_tolerance_px = simplify_tolerance_px

    def vectorize_parcels(
        self, label_map: np.ndarray, parcel_info: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Extracts clean, simplified vector polygons for each labeled parcel.
        """
        vectorized_parcels = []

        for p_data in parcel_info:
            pid = p_data["parcel_id"]
            mask = (label_map == pid).astype(np.uint8) * 255

            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                continue

            # Take the largest contour for this parcel ID
            main_contour = max(contours, key=cv2.contourArea)
            if len(main_contour) < 3:
                continue

            # Douglas-Peucker simplification
            epsilon = self.simplify_tolerance_px
            approx = cv2.approxPolyDP(main_contour, epsilon, True)
            if len(approx) < 3:
                approx = main_contour  # Fallback to original if over-simplified

            pts = approx.reshape(-1, 2)
            coords = pts.tolist()

            # Ensure polygon ring is closed
            if coords[0] != coords[-1]:
                coords.append(coords[0])

            try:
                poly = Polygon(coords)
                if not poly.is_valid:
                    poly = make_valid(poly)

                # If result is MultiPolygon, take largest component
                if isinstance(poly, MultiPolygon):
                    poly = max(poly.geoms, key=lambda g: g.area)

                if poly.is_empty or poly.area < 1.0:
                    continue

                exterior_coords = list(poly.exterior.coords)
                clean_coords = [[float(pt[0]), float(pt[1])] for pt in exterior_coords]

                vectorized_parcels.append(
                    {
                        "parcel_id": pid,
                        "shapely_polygon": poly,
                        "pixel_coordinates": clean_coords,
                        "pixel_area": float(poly.area),
                        "pixel_perimeter": float(poly.length),
                        "centroid_px": (float(poly.centroid.x), float(poly.centroid.y)),
                    }
                )
            except Exception:
                continue

        return vectorized_parcels
