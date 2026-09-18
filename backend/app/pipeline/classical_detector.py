"""
Classical Agricultural Bund and Parcel Detector
Combines ridge filtering, adaptive Canny edge detection, morphological closing,
and marker-controlled watershed / connected components to extract field parcels.
"""

from typing import Dict, Any, Tuple
import cv2
import numpy as np
from scipy import ndimage


class ClassicalBundDetector:
    def __init__(
        self,
        canny_low: int = 50,
        canny_high: int = 130,
        morph_kernel_size: int = 5,
        min_parcel_area_ratio: float = 0.008,  # minimum 0.8% of image area
        max_parcel_area_ratio: float = 0.85,   # maximum 85% of image area (avoid full background)
    ):
        self.canny_low = canny_low
        self.canny_high = canny_high
        self.morph_kernel_size = morph_kernel_size
        self.min_parcel_area_ratio = min_parcel_area_ratio
        self.max_parcel_area_ratio = max_parcel_area_ratio

    def detect_bund_edges(self, enhanced_gray: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detects linear bund features using combined Sobel gradients and Canny edge detection.
        Returns:
            edges: binary mask of detected edge pixels
            confidence: float32 confidence map based on gradient magnitude
        """
        # Sobel gradient magnitude
        grad_x = cv2.Sobel(enhanced_gray, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(enhanced_gray, cv2.CV_64F, 0, 1, ksize=3)
        grad_mag = np.sqrt(grad_x**2 + grad_y**2)
        grad_norm = cv2.normalize(grad_mag, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)

        # Canny edge detection
        canny_edges = cv2.Canny(enhanced_gray, self.canny_low, self.canny_high)

        # Morphological gradient to capture thin boundary ridges
        kernel_ridge = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        morph_grad = cv2.morphologyEx(enhanced_gray, cv2.MORPH_GRADIENT, kernel_ridge)
        _, morph_thresh = cv2.threshold(morph_grad, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Fuse edge signals
        grad_bin = (grad_norm > 75).astype(np.uint8) * 255
        fused = cv2.bitwise_or(canny_edges, cv2.bitwise_and(grad_bin, morph_thresh))

        # Filter out stray micro-edge noise (< 20 connected edge pixels)
        nb_components, output, stats, _ = cv2.connectedComponentsWithStats(fused, connectivity=8)
        clean_edges = np.zeros_like(fused)
        for i in range(1, nb_components):
            if stats[i, cv2.CC_STAT_AREA] >= 20:
                clean_edges[output == i] = 255

        # Confidence map normalized to [0, 1]
        confidence_map = grad_mag / (np.max(grad_mag) + 1e-6)

        return clean_edges.astype(np.uint8), confidence_map.astype(np.float32)

    def close_bund_gaps(self, edges: np.ndarray) -> np.ndarray:
        """
        Applies directional and elliptical morphological closing to bridge gaps in bund boundaries.
        """
        k_size = self.morph_kernel_size
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)
        # Slight dilation ensures continuous watertight barrier along bund crests
        closed = cv2.dilate(closed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)

        # Add image boundary as barrier so edge fields are fully enclosed
        h, w = edges.shape
        closed[0, :] = 255
        closed[h - 1, :] = 255
        closed[:, 0] = 255
        closed[:, w - 1] = 255

        return closed

    def segment_parcels(
        self, closed_bund_mask: np.ndarray, original_shape: Tuple[int, int]
    ) -> Tuple[np.ndarray, int, list]:
        """
        Segments enclosed regions between bund lines into distinct parcels.
        Uses inversion + connected component analysis.
        """
        h, w = original_shape
        total_pixels = h * w
        min_area = int(total_pixels * self.min_parcel_area_ratio)
        max_area = int(total_pixels * self.max_parcel_area_ratio)

        # Invert closed edges: bunds = 0, parcel interiors = 255
        interior = cv2.bitwise_not(closed_bund_mask)

        # Connected component labeling
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            interior, connectivity=8
        )

        valid_labels = np.zeros_like(labels, dtype=np.int32)
        parcel_info = []
        new_id = 1

        for label_idx in range(1, num_labels):
            area = stats[label_idx, cv2.CC_STAT_AREA]
            if area < min_area or area > max_area:
                continue

            # Check if this region touches all 4 borders (typically outside background/canvas)
            x = stats[label_idx, cv2.CC_STAT_LEFT]
            y = stats[label_idx, cv2.CC_STAT_TOP]
            stat_w = stats[label_idx, cv2.CC_STAT_WIDTH]
            stat_h = stats[label_idx, cv2.CC_STAT_HEIGHT]

            # If it spans almost the full canvas width and height, it is an outer border ring/frame
            if stat_w > 0.85 * w and stat_h > 0.85 * h:
                continue

            valid_labels[labels == label_idx] = new_id
            cx, cy = centroids[label_idx]
            parcel_info.append(
                {
                    "parcel_id": new_id,
                    "pixel_area": int(area),
                    "centroid_px": (float(cx), float(cy)),
                    "bbox": (int(x), int(y), int(stat_w), int(stat_h)),
                }
            )
            new_id += 1

        return valid_labels, len(parcel_info), parcel_info

    def detect(self, preprocessed_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs the full classical bund detection and parcel segmentation pipeline.
        """
        enhanced = preprocessed_data["enhanced"]
        dimensions = preprocessed_data["dimensions"]

        # 1. Edge & Ridge Detection
        edges, confidence_map = self.detect_bund_edges(enhanced)

        # 2. Morphological Gap Closing
        closed_bunds = self.close_bund_gaps(edges)

        # 3. Parcel Segmentation
        label_map, parcel_count, parcel_info = self.segment_parcels(closed_bunds, dimensions)

        return {
            "edge_mask": edges,
            "closed_bund_mask": closed_bunds,
            "label_map": label_map,
            "parcel_count": parcel_count,
            "parcel_info": parcel_info,
            "confidence_map": confidence_map,
        }
