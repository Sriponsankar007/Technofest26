"""
GIS Export API Endpoint
Exports detected or user-edited parcels as GIS-compatible GeoJSON or ESRI Shapefile (.zip).
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Response, Body
from fastapi.responses import JSONResponse
from app.api.detect import get_latest_result, pipeline

router = APIRouter(prefix="/api/export", tags=["Export"])


@router.get("/{export_format}")
def export_last_parcels(export_format: str):
    """Exports the most recently detected parcels in GeoJSON or Shapefile format."""
    latest = get_latest_result()
    if not latest or "geojson" not in latest:
        raise HTTPException(
            status_code=400,
            detail="No parcels detected yet. Please upload an image and run detection first.",
        )

    geojson = latest["geojson"]
    return _format_export(geojson, export_format)


@router.post("/{export_format}")
def export_custom_parcels(
    export_format: str,
    custom_geojson: Dict[str, Any] = Body(...),
):
    """Exports custom or edited GeoJSON (from client-side vertex corrections)."""
    return _format_export(custom_geojson, export_format)


def _format_export(geojson: Dict[str, Any], export_format: str):
    fmt = export_format.lower()

    if fmt in ["geojson", "json"]:
        return JSONResponse(
            content=geojson,
            headers={
                "Content-Disposition": "attachment; filename=agricultural_parcels.geojson"
            },
        )
    elif fmt in ["shapefile", "shp", "zip"]:
        zip_bytes = pipeline.geo_engine.generate_shapefile_zip(geojson)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=agricultural_parcels_shapefile.zip"
            },
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format '{export_format}'. Supported formats: 'geojson', 'shapefile'.",
        )
