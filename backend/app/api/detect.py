"""
Bund & Parcel Detection API Endpoint
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from app.pipeline.pipeline_runner import BundDetectionPipeline

router = APIRouter(prefix="/api/detect", tags=["Detection"])

# Pipeline singleton instance
pipeline = BundDetectionPipeline()

# In-memory storage for last detection result to support direct export and AI query
LATEST_RESULT: Dict[str, Any] = {}


@router.post("")
async def detect_parcels(
    file: UploadFile = File(...),
    gsd_cm: Optional[float] = Form(5.0),
    use_ml: Optional[bool] = Form(True),
):
    """
    Receives drone/satellite farmland image and returns:
    - GeoJSON FeatureCollection with polygon boundaries and metric attributes
    - Base64 overlay image with drawn bund lines and parcel IDs
    - Base64 confidence heatmap
    - Aggregate statistics (count, total acres, mean size)
    """
    global LATEST_RESULT

    content_type = file.content_type or ""
    filename = (file.filename or "").lower()
    valid_exts = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp")
    if content_type and not (content_type.startswith("image/") or content_type == "application/octet-stream" or filename.endswith(valid_exts)):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image (GeoTIFF, PNG, JPG).")

    try:
        image_bytes = await file.read()
        result = pipeline.run(
            image_input=image_bytes,
            gsd_cm=gsd_cm,
            use_ml_refinement=use_ml,
            save_debug=True,
        )

        # Cache latest result for export and AI queries
        LATEST_RESULT = {
            "geojson": result["parcels"],
            "stats": result["stats"],
            "filename": file.filename,
        }

        return {
            "overlay_image_base64": result["overlay_image_base64"],
            "confidence_map_base64": result["confidence_map_base64"],
            "parcels": result["parcels"],
            "stats": result["stats"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")


def get_latest_result() -> Dict[str, Any]:
    return LATEST_RESULT
