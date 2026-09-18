"""
Agricultural Image Preprocessor
Applies CLAHE (Contrast Limited Adaptive Histogram Equalization),
noise reduction, and color space normalizations to accentuate agricultural bunds.
"""

from typing import Tuple, Union
import cv2
import numpy as np


class ImagePreprocessor:
    def __init__(self, clip_limit: float = 3.0, tile_grid_size: Tuple[int, int] = (8, 8)):
        self.clip_limit = clip_limit
        self.tile_grid_size = tile_grid_size
        self.clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)

    def load_image(self, input_source: Union[str, bytes, np.ndarray]) -> np.ndarray:
        """Loads an image from file path, bytes, or numpy array."""
        if isinstance(input_source, np.ndarray):
            return input_source
        elif isinstance(input_source, bytes):
            nparr = np.frombuffer(input_source, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Failed to decode image from bytes.")
            return img
        elif isinstance(input_source, str):
            img = cv2.imread(input_source, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError(f"Failed to read image from path: {input_source}")
            return img
        else:
            raise TypeError("Unsupported image source type.")

    def preprocess(self, image: np.ndarray) -> dict:
        """
        Preprocesses drone/aerial image:
        - Converts BGR to RGB and Grayscale
        - Applies bilateral filtering to smooth field texture while preserving sharp bund boundaries
        - Applies CLAHE contrast enhancement to amplify subtle bund shadows & ridges
        """
        if len(image.shape) == 2:
            rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
            gray = image.copy()
        else:
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Bilateral filter preserves sharp bund ridge edges while smoothing soil noise
        smoothed = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)
        # Gentle Gaussian blur suppresses micro-furrows and sensor noise
        smoothed = cv2.GaussianBlur(smoothed, (5, 5), 1.5)

        # Enhance contrast of bund ridges
        enhanced = self.clahe.apply(smoothed)

        return {
            "rgb": rgb,
            "gray": gray,
            "smoothed": smoothed,
            "enhanced": enhanced,
            "dimensions": (image.shape[0], image.shape[1]),  # (H, W)
        }
