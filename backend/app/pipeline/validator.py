"""
Pipeline Output Validator
Validates plausibility of parcel detection results to guard against over-segmentation,
under-segmentation, degenerate polygons, or model artifacts.
"""

from typing import List, Dict, Any, Tuple


class ParcelValidator:
    def __init__(
        self,
        min_parcels: int = 1,
        max_parcels: int = 250,
        min_coverage_ratio: float = 0.15,
        max_single_parcel_ratio: float = 0.85,
    ):
        self.min_parcels = min_parcels
        self.max_parcels = max_parcels
        self.min_coverage_ratio = min_coverage_ratio
        self.max_single_parcel_ratio = max_single_parcel_ratio

    def validate(
        self, enriched_parcels: List[Dict[str, Any]], image_shape: Tuple[int, int]
    ) -> Tuple[bool, str]:
        """
        Validates the plausibility of parcel segmentation output.
        Returns:
            is_valid (bool): Whether the result passes heuristic sanity checks
            reason (str): Diagnostic description if validation failed
        """
        n = len(enriched_parcels)
        if n < self.min_parcels:
            return False, f"Under-segmented: 0 parcels detected (min expected {self.min_parcels})."
        if n > self.max_parcels:
            return False, f"Over-segmented: {n} parcels detected (max allowable {self.max_parcels})."

        h, w = image_shape
        total_image_pixels = h * w

        areas_px = [p.get("pixel_area", p.get("area_sqm", 0.0)) for p in enriched_parcels]
        total_detected_pixels = sum(areas_px)
        max_area = max(areas_px)

        coverage_ratio = total_detected_pixels / (total_image_pixels + 1e-6)
        if coverage_ratio < self.min_coverage_ratio:
            return False, f"Low coverage: detected parcels cover only {coverage_ratio*100:.1f}% of image (min {self.min_coverage_ratio*100}% required)."

        # If more than 1 parcel, no single parcel should dominate > 85% of total detected area
        if n > 1 and (max_area / (total_detected_pixels + 1e-6)) > self.max_single_parcel_ratio:
            return False, "Anomalous parcel distribution: Single parcel dominates majority of area."

        return True, "Passed sanity checks."
