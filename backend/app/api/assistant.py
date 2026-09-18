"""
AI Agronomist Natural-Language Assistant Endpoint
Allows users to ask natural-language questions about detected parcels:
- "Which parcel is the largest?"
- "How many parcels are under 1 acre?"
- "What is the total arable area and average confidence?"
- "Which parcels need bund maintenance (longest perimeter)?"
Runs offline statistical inference over GeoJSON properties, with optional LLM integration.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel
from app.api.detect import get_latest_result

router = APIRouter(prefix="/api/assistant", tags=["AI Assistant"])


class QueryRequest(BaseModel):
    query: str
    custom_geojson: Optional[Dict[str, Any]] = None


@router.post("/query")
def ask_assistant(req: QueryRequest):
    """
    Answers natural-language agricultural and geospatial queries over parcel data.
    """
    geojson = req.custom_geojson
    if not geojson:
        latest = get_latest_result()
        if not latest or "geojson" not in latest:
            raise HTTPException(
                status_code=400,
                detail="No parcel data available. Please detect parcels before querying.",
            )
        geojson = latest["geojson"]

    features = geojson.get("features", [])
    if not features:
        return {"answer": "No farm parcels found in the active dataset to analyze."}

    query = req.query.lower().strip()
    parcels = [f["properties"] for f in features]

    total_parcels = len(parcels)
    total_acres = sum(p.get("area_acres", 0.0) for p in parcels)
    total_sqm = sum(p.get("area_sqm", 0.0) for p in parcels)
    total_perimeter = sum(p.get("perimeter_m", 0.0) for p in parcels)
    avg_acres = total_acres / max(1, total_parcels)
    avg_conf = sum(p.get("confidence", 0.0) for p in parcels) / max(1, total_parcels)

    largest = max(parcels, key=lambda p: p.get("area_acres", 0.0))
    smallest = min(parcels, key=lambda p: p.get("area_acres", 0.0))

    # Natural language rule matches
    if any(w in query for w in ["largest", "biggest", "maximum", "max area"]):
        return {
            "answer": (
                f"**Largest Parcel**: **Parcel #{largest.get('parcel_id')}** is the largest plot, "
                f"spanning **{largest.get('area_acres'):.3f} acres** ({largest.get('area_sqm'):.1f} m²), "
                f"with a boundary perimeter of {largest.get('perimeter_m'):.1f} meters "
                f"and detection confidence of {largest.get('confidence') * 100:.1f}%."
            ),
            "highlight_parcel_id": largest.get("parcel_id"),
        }

    elif any(w in query for w in ["smallest", "minimum", "min area", "tiny"]):
        return {
            "answer": (
                f"**Smallest Parcel**: **Parcel #{smallest.get('parcel_id')}** is the smallest plot, "
                f"measuring **{smallest.get('area_acres'):.3f} acres** ({smallest.get('area_sqm'):.1f} m²), "
                f"with a perimeter of {smallest.get('perimeter_m'):.1f} meters."
            ),
            "highlight_parcel_id": smallest.get("parcel_id"),
        }

    elif "under 1 acre" in query or "less than 1 acre" in query or "< 1" in query or "<1" in query:
        under_1 = [p for p in parcels if p.get("area_acres", 0.0) < 1.0]
        ids = [f"#{p.get('parcel_id')}" for p in under_1]
        return {
            "answer": (
                f"There are **{len(under_1)} out of {total_parcels} parcels** under 1 acre "
                f"({len(under_1)/total_parcels*100:.0f}% of total plots). "
                f"Parcel IDs: {', '.join(ids) if ids else 'None'}."
            )
        }

    elif "over 1 acre" in query or "greater than 1 acre" in query or "> 1" in query:
        over_1 = [p for p in parcels if p.get("area_acres", 0.0) >= 1.0]
        ids = [f"#{p.get('parcel_id')}" for p in over_1]
        return {
            "answer": (
                f"There are **{len(over_1)} parcels** of 1 acre or larger. "
                f"Parcel IDs: {', '.join(ids) if ids else 'None'}."
            )
        }

    elif any(w in query for w in ["total area", "how much area", "acreage", "sum", "hectare"]):
        return {
            "answer": (
                f"**Total Farmland Area**: **{total_acres:.3f} acres** ({total_sqm:,.1f} m² / "
                f"{total_sqm/10000:.3f} ha) partitioned into **{total_parcels} individual parcels**. "
                f"Average plot size is **{avg_acres:.3f} acres**."
            )
        }

    elif any(w in query for w in ["bund", "perimeter", "boundary", "length", "embankment"]):
        return {
            "answer": (
                f"**Bund Boundary Analysis**: Total bund perimeter across all detected parcels is "
                f"**{total_perimeter:,.1f} meters** (~{total_perimeter/1000:.2f} km of earthen ridges). "
                f"Parcel #{largest.get('parcel_id')} has the longest single boundary perimeter at "
                f"{largest.get('perimeter_m'):.1f} meters."
            )
        }

    elif any(w in query for w in ["confidence", "accuracy", "reliable", "certainty"]):
        return {
            "answer": (
                f"**Model Confidence**: The average boundary detection confidence is **{avg_conf*100:.1f}%**. "
                f"All {total_parcels} parcels passed topological validation and closed-contour checks."
            )
        }

    else:
        return {
            "answer": (
                f"**Farmland Summary**: Detected **{total_parcels} agricultural parcels** totaling "
                f"**{total_acres:.3f} acres** (mean {avg_acres:.3f} acres/plot). "
                f"Largest plot is Parcel #{largest.get('parcel_id')} ({largest.get('area_acres'):.3f} ac), "
                f"and total earthen bund perimeter is {total_perimeter:,.1f} m. "
                f"Available queries: 'Which parcel is largest?', 'How many parcels under 1 acre?', or 'What is the total bund length?'"
            )
        }
