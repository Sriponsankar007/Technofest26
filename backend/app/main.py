"""
FastAPI Main Application
AI-Based Agricultural Land Parcel & Bund Detection System
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.detect import router as detect_router
from app.api.export import router as export_router
from app.api.assistant import router as assistant_router
from app.api.samples import router as samples_router

app = FastAPI(
    title="AgriBund AI - Agricultural Land Parcel & Bund Detection",
    description="Dual-engine classical CV and ML pipeline for automated farm parcel segmentation, area calculation, and GIS export.",
    version="1.0.0",
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(detect_router)
app.include_router(export_router)
app.include_router(assistant_router)
app.include_router(samples_router)

# Mount samples directory for direct static access
samples_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples")
if os.path.exists(samples_dir):
    app.mount("/static/samples", StaticFiles(directory=samples_dir), name="samples")


@app.get("/")
def root():
    return {
        "status": "healthy",
        "service": "AgriBund AI Detection Engine",
        "version": "1.0.0",
        "endpoints": {
            "detect": "POST /api/detect",
            "export": "GET /api/export/{format}",
            "assistant": "POST /api/assistant/query",
            "samples": "GET /api/samples",
            "docs": "/docs",
        },
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "cv_engine": "ready", "gis_engine": "ready"}
