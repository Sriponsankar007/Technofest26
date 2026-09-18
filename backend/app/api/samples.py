"""
Sample Images API Endpoint
Allows frontend users to test sample agricultural aerial images with one click.
"""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/samples", tags=["Samples"])

SAMPLES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "samples")


@router.get("")
def list_samples():
    """Returns metadata for built-in sample farmland images."""
    if not os.path.exists(SAMPLES_DIR):
        os.makedirs(SAMPLES_DIR, exist_ok=True)

    samples = [
        {
            "id": "sector_1_central",
            "name": "Central Farmland Basin (Sector 1)",
            "description": "High-density irrigated agricultural plots (16 parcels, 107.6 acres) from SF5, SF6 Orthomosaic.",
            "default_gsd_cm": 42.24,
            "filename": "sector_1_central.png",
            "url": "/api/samples/sector_1_central.png",
            "geojson_url": "/api/samples/sector_1_central.geojson",
        },
        {
            "id": "sector_2_north",
            "name": "North Terraced Plots (Sector 2)",
            "description": "Contour-bunded dryland parcels (12 parcels, 129.7 acres) from SF5, SF6 Orthomosaic.",
            "default_gsd_cm": 42.24,
            "filename": "sector_2_north.png",
            "url": "/api/samples/sector_2_north.png",
            "geojson_url": "/api/samples/sector_2_north.geojson",
        },
        {
            "id": "sector_3_south",
            "name": "South Riverbed Parcels (Sector 3)",
            "description": "Alluvial riverbank agricultural parcels (7 parcels, 25.4 acres) from SF5, SF6 Orthomosaic.",
            "default_gsd_cm": 42.24,
            "filename": "sector_3_south.png",
            "url": "/api/samples/sector_3_south.png",
            "geojson_url": "/api/samples/sector_3_south.geojson",
        },
        {
            "id": "master_cadastral_survey",
            "name": "Master Cadastral Survey (Combined 35 Parcels)",
            "description": "Consolidated cadastral survey across all processed sectors (262.7 acres / 106.3 ha).",
            "default_gsd_cm": 42.24,
            "filename": "sector_1_central.png",
            "url": "/api/samples/sector_1_central.png",
            "geojson_url": "/api/samples/master_cadastral_survey.geojson",
        },
        {
            "id": "synthetic_farm_grid",
            "name": "Synthetic Cadastral Farm Grid (Ground Truth)",
            "description": "6 mathematically defined parcels with regular bund lines. Ideal for unit verification.",
            "default_gsd_cm": 10.0,
            "filename": "synthetic_farm_grid.png",
            "url": "/api/samples/synthetic_farm_grid.png",
        },
    ]

    return {"samples": samples}


@router.get("/{filename}")
def get_sample_image(filename: str):
    """Serves the raw image or geospatial deliverable file for a given sample."""
    filepath = os.path.join(SAMPLES_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Sample file not found.")
    
    if filename.endswith(".geojson"):
        return FileResponse(filepath, media_type="application/geo+json")
    elif filename.endswith(".zip"):
        return FileResponse(filepath, media_type="application/zip")
    return FileResponse(filepath, media_type="image/png")
