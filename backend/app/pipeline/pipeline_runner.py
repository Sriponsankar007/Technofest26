"""
End-to-End Pipeline Runner
Coordinates preprocessing, bund detection, validation, vectorization,
geospatial referencing, and visual checkpoint generation.
"""

import base64
import os
from typing import Dict, Any, Tuple, Optional
import cv2
import numpy as np

from .preprocessor import ImagePreprocessor
from .classical_detector import ClassicalBundDetector
from .ml_detector import MLRefinedBundDetector
from .vectorizer import ParcelVectorizer
from .geo import GeoEngine
from .validator import ParcelValidator


class BundDetectionPipeline:
    def __init__(
        self,
        default_gsd_cm: float = 5.0,
        debug_dir: str = "debug_outputs",
    ):
        self.preprocessor = ImagePreprocessor()
        self.classical_detector = ClassicalBundDetector()
        self.ml_detector = MLRefinedBundDetector()
        self.validator = ParcelValidator()
        self.vectorizer = ParcelVectorizer()
        self.geo_engine = GeoEngine(default_gsd_cm=default_gsd_cm)
        self.debug_dir = debug_dir

        if not os.path.exists(debug_dir):
            os.makedirs(debug_dir, exist_ok=True)

    def run(
        self,
        image_input,
        gsd_cm: Optional[float] = None,
        use_ml_refinement: bool = True,
        save_debug: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes end-to-end pipeline.
        Returns:
            result dict with GeoJSON, overlay base64, statistics, and debug checkpoint images.
        """
        if gsd_cm is None or gsd_cm <= 0:
            gsd_cm = self.geo_engine.default_gsd_cm

        # Step 1: Load and Preprocess
        raw_img = self.preprocessor.load_image(image_input)
        preprocessed = self.preprocessor.preprocess(raw_img)
        enhanced = preprocessed["enhanced"]
        rgb = preprocessed["rgb"]
        dims = preprocessed["dimensions"]

        # Step 2: Bund Detection (Classical baseline first)
        classical_result = self.classical_detector.detect(preprocessed)
        edges = classical_result["edge_mask"]
        closed = classical_result["closed_bund_mask"]
        labels = classical_result["label_map"]
        p_info = classical_result["parcel_info"]
        conf_map = classical_result["confidence_map"]
        engine_mode = "classical_cv"

        # Step 3: Optional ML Refinement with Automated Sanity Fallback
        if use_ml_refinement:
            try:
                ml_edges, ml_conf = self.ml_detector.refine_bund_mask(enhanced, edges)
                ml_closed = self.classical_detector.close_bund_gaps(ml_edges)
                ml_labels, ml_count, ml_p_info = self.classical_detector.segment_parcels(
                    ml_closed, dims
                )

                # Vectorize candidate ML parcels for validation
                candidate_vectors = self.vectorizer.vectorize_parcels(ml_labels, ml_p_info)
                candidate_parcels = self.geo_engine.compute_metrics(
                    candidate_vectors, ml_conf, gsd_cm
                )

                # Plausibility check
                is_valid, reason = self.validator.validate(candidate_parcels, dims)
                if is_valid:
                    edges = ml_edges
                    closed = ml_closed
                    labels = ml_labels
                    p_info = ml_p_info
                    conf_map = ml_conf
                    engine_mode = "ml_refined"
                else:
                    # Graceful fallback to verified classical CV baseline
                    engine_mode = f"classical_cv (fallback: {reason})"
            except Exception:
                engine_mode = "classical_cv (fallback: error during ML refinement)"

        # Step 4: Final Vectorization
        vectorized = self.vectorizer.vectorize_parcels(labels, p_info)

        # Step 5: Geospatial metric calculation & GeoJSON creation
        enriched = self.geo_engine.compute_metrics(vectorized, conf_map, gsd_cm)
        geojson = self.geo_engine.to_geojson(enriched, dims, gsd_cm)

        # Step 6: Create visual overlay & debug checkpoints
        overlay_img, colored_labels = self._generate_visualizations(
            rgb, edges, labels, enriched
        )

        # Save debug checkpoints to disk
        if save_debug:
            self._save_checkpoints(enhanced, edges, closed, colored_labels, overlay_img)

        # Base64 encodings for API and web UI
        overlay_b64 = self._mat_to_base64(cv2.cvtColor(overlay_img, cv2.COLOR_RGB2BGR))
        conf_b64 = self._mat_to_base64((conf_map * 255).astype(np.uint8))

        stats = {
            "parcel_count": len(enriched),
            "total_area_sqm": geojson["properties"]["total_area_sqm"],
            "total_area_acres": geojson["properties"]["total_area_acres"],
            "average_parcel_acres": round(
                geojson["properties"]["total_area_acres"] / max(1, len(enriched)), 3
            ),
            "gsd_cm": gsd_cm,
            "engine_mode": engine_mode,
            "image_width": dims[1],
            "image_height": dims[0],
        }

        return {
            "overlay_image_base64": overlay_b64,
            "confidence_map_base64": conf_b64,
            "parcels": geojson,
            "stats": stats,
            "internal_parcels": enriched,
        }

    def _generate_visualizations(
        self, rgb: np.ndarray, edges: np.ndarray, labels: np.ndarray, parcels: list
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Creates colorful overlay and labeled visualization."""
        overlay = rgb.copy()

        # Generate distinct colors for parcels
        np.random.seed(42)
        colors = np.random.randint(40, 240, size=(len(parcels) + 1, 3))

        # Color-coded parcel map
        colored_labels = np.zeros_like(rgb)
        for p in parcels:
            pid = p["parcel_id"]
            color = colors[pid].tolist()
            colored_labels[labels == pid] = color

            # Draw polygon boundary on overlay
            pts = np.array(p["pixel_coordinates"], dtype=np.int32).reshape((-1, 1, 2))
            cv2.polylines(overlay, [pts], isClosed=True, color=(0, 255, 128), thickness=2)

            # Draw parcel ID label at centroid
            cx, cy = int(p["centroid_px"][0]), int(p["centroid_px"][1])
            cv2.putText(
                overlay,
                f"P{pid}",
                (cx - 12, cy + 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )
            cv2.putText(
                overlay,
                f"P{pid}",
                (cx - 12, cy + 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 50, 20),
                1,
                cv2.LINE_AA,
            )

        # Highlight detected bund lines in radiant amber/orange
        overlay[edges > 0] = [255, 170, 0]

        return overlay, colored_labels

    def _save_checkpoints(self, enhanced, edges, closed, colored_labels, overlay_img):
        """Saves intermediate debug images for strict verification."""
        cv2.imwrite(os.path.join(self.debug_dir, "01_clahe_enhanced.png"), enhanced)
        cv2.imwrite(os.path.join(self.debug_dir, "02_bund_edges.png"), edges)
        cv2.imwrite(os.path.join(self.debug_dir, "03_closed_bunds.png"), closed)
        cv2.imwrite(
            os.path.join(self.debug_dir, "04_parcel_labels_colored.png"),
            cv2.cvtColor(colored_labels, cv2.COLOR_RGB2BGR),
        )
        cv2.imwrite(
            os.path.join(self.debug_dir, "05_vector_overlay.png"),
            cv2.cvtColor(overlay_img, cv2.COLOR_RGB2BGR),
        )

    def _mat_to_base64(self, mat: np.ndarray) -> str:
        """Encodes OpenCV image array to base64 PNG string."""
        _, buf = cv2.imencode(".png", mat)
        return f"data:image/png;base64,{base64.b64encode(buf).decode('utf-8')}"
