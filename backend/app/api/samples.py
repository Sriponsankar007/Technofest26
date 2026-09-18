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
            "name": "Central Basin (Sector 1)",
            "category": "SF5 Drone Survey (42 cm/px)",
            "description": "High-density irrigated agricultural plots with prominent earthen bunds.",
            "plots": 16,
            "acres": 107.6,
            "default_gsd_cm": 42.24,
            "filename": "sector_1_central.png",
            "url": "/api/samples/sector_1_central.png",
            "geojson_url": "/api/samples/sector_1_central.geojson",
        },
        {
            "id": "sector_4_east",
            "name": "East Canal Basin (Sector 4)",
            "category": "SF5 Drone Survey (42 cm/px)",
            "description": "Rectilinear irrigation canal plots with sharp field boundary ridges.",
            "plots": 14,
            "acres": 98.2,
            "default_gsd_cm": 42.24,
            "filename": "sector_4_east.png",
            "url": "/api/samples/sector_4_east.png",
            "geojson_url": "/api/samples/sector_4_east.geojson",
        },
        {
            "id": "sector_2_north",
            "name": "North Terraces (Sector 2)",
            "category": "SF5 Drone Survey (42 cm/px)",
            "description": "Contour-bunded dryland parcels and sloped terrain plots.",
            "plots": 12,
            "acres": 129.7,
            "default_gsd_cm": 42.24,
            "filename": "sector_2_north.png",
            "url": "/api/samples/sector_2_north.png",
            "geojson_url": "/api/samples/sector_2_north.geojson",
        },
        {
            "id": "sector_5_west",
            "name": "West Foothill Plots (Sector 5)",
            "category": "SF5 Drone Survey (42 cm/px)",
            "description": "Foothill agricultural parcels bordering scrub terrain with curved bunds.",
            "plots": 11,
            "acres": 84.5,
            "default_gsd_cm": 42.24,
            "filename": "sector_5_west.png",
            "url": "/api/samples/sector_5_west.png",
            "geojson_url": "/api/samples/sector_5_west.geojson",
        },
        {
            "id": "sector_3_south",
            "name": "South Riverbed (Sector 3)",
            "category": "SF5 Drone Survey (42 cm/px)",
            "description": "Alluvial riverbank agricultural parcels along meandering waterway.",
            "plots": 7,
            "acres": 25.4,
            "default_gsd_cm": 42.24,
            "filename": "sector_3_south.png",
            "url": "/api/samples/sector_3_south.png",
            "geojson_url": "/api/samples/sector_3_south.geojson",
        },
        {
            "id": "maharashtra_paddy_bunds",
            "name": "Terraced Paddy Bunds",
            "category": "Regional Farmland Benchmark",
            "description": "Traditional water-retaining stepped paddy bunds with narrow ridge walls.",
            "plots": 8,
            "acres": 18.2,
            "default_gsd_cm": 25.0,
            "filename": "maharashtra_paddy_bunds.png",
            "url": "/api/samples/maharashtra_paddy_bunds.png",
        },
        {
            "id": "synthetic_farm_grid",
            "name": "Ground-Truth Cadastral Grid",
            "category": "Mathematical Validation",
            "description": "6 mathematically defined parcels with regular bund lines for accuracy calibration.",
            "plots": 6,
            "acres": 3.7,
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
