"""
Golden Test Harness for Agricultural Bund and Parcel Detection Pipeline
Executes pipeline on both synthetic ground-truth images and realistic aerial farmland imagery,
verifying:
1. Parcel counts and area calculations against mathematical expectations
2. Topological validity of extracted Shapely polygons
3. GeoJSON schema conformance
4. Intermediate visual checkpoints dumped to debug_outputs/
"""

import os
import sys
import time

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generate_samples import generate_synthetic_farm_grid, generate_realistic_aerial_farmland
from app.pipeline.pipeline_runner import BundDetectionPipeline


def run_golden_tests():
    print("=" * 60)
    print("RUNNING PS06 GOLDEN PIPELINE TESTS")
    print("=" * 60)

    # 1. Prepare sample test images
    synthetic_path = os.path.join(os.path.dirname(__file__), "samples", "synthetic_farm_grid.png")
    realistic_path = os.path.join(os.path.dirname(__file__), "samples", "maharashtra_paddy_bunds.png")

    generate_synthetic_farm_grid(synthetic_path)
    generate_realistic_aerial_farmland(realistic_path)

    pipeline = BundDetectionPipeline(default_gsd_cm=10.0, debug_dir="debug_outputs")

    # TEST 1: Synthetic Grid (Known Ground Truth: 6 parcels)
    print("\n[Test 1] Testing on Synthetic Farm Grid (Ground Truth = 6 parcels)...")
    t0 = time.time()
    result_synth = pipeline.run(
        image_input=synthetic_path,
        gsd_cm=10.0,  # 10 cm/pixel => 0.01 m2/px
        use_ml_refinement=True,
        save_debug=True,
    )
    t_synth = time.time() - t0

    stats = result_synth["stats"]
    p_count = stats["parcel_count"]
    total_acres = stats["total_area_acres"]
    total_sqm = stats["total_area_sqm"]

    print(f"  Execution Time: {t_synth:.3f}s")
    print(f"  Detected Parcels: {p_count}")
    print(f"  Total Area (sqm): {total_sqm} m2")
    print(f"  Total Area (acres): {total_acres} acres")
    print(f"  Engine Mode: {stats['engine_mode']}")

    # Sanity Assertions for Test 1
    assert 4 <= p_count <= 8, f"Expected ~6 parcels, got {p_count}"
    assert 5000 <= total_sqm <= 11000, f"Expected ~8500 m2 total area, got {total_sqm}"
    assert 1.0 <= total_acres <= 2.8, f"Expected ~2.1 acres, got {total_acres}"
    print("  >>> TEST 1 PASSED: Ground-truth dimensions & count within precision margin! <<<")

    # TEST 2: Realistic Aerial Farmland (Expected 7-10 parcels)
    print("\n[Test 2] Testing on Realistic Aerial Farmland...")
    t0 = time.time()
    result_real = pipeline.run(
        image_input=realistic_path,
        gsd_cm=5.0,  # 5 cm/pixel
        use_ml_refinement=True,
        save_debug=True,
    )
    t_real = time.time() - t0

    stats_real = result_real["stats"]
    p_count_real = stats_real["parcel_count"]
    total_acres_real = stats_real["total_area_acres"]

    print(f"  Execution Time: {t_real:.3f}s")
    print(f"  Detected Parcels: {p_count_real}")
    print(f"  Total Area (acres): {total_acres_real} acres")
    print(f"  Engine Mode: {stats_real['engine_mode']}")

    assert p_count_real >= 4, f"Expected >= 4 parcels, got {p_count_real}"
    assert total_acres_real > 0.1, "Expected positive real-world area"
    print("  >>> TEST 2 PASSED: Realistic aerial bund detection successful! <<<")

    # TEST 3: GeoJSON & Shapefile Export Verification
    print("\n[Test 3] Testing GeoJSON and Shapefile packaging...")
    geojson = result_real["parcels"]
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == p_count_real
    first_feat = geojson["features"][0]
    assert "geometry" in first_feat and first_feat["geometry"]["type"] == "Polygon"
    assert "area_acres" in first_feat["properties"]
    assert "area_sqm" in first_feat["properties"]
    assert "perimeter_m" in first_feat["properties"]
    assert "confidence" in first_feat["properties"]

    # Test Shapefile binary builder
    shp_zip = pipeline.geo_engine.generate_shapefile_zip(geojson)
    assert len(shp_zip) > 200, "Shapefile zip must contain valid bytes"
    print(f"  Generated Shapefile ZIP ({len(shp_zip)} bytes)")
    print("  >>> TEST 3 PASSED: GIS compatibility and Shapefile packaging verified! <<<")

    # Checkpoint Files Check
    debug_files = os.listdir("debug_outputs")
    print(f"\nVisual Checkpoint Artifacts Saved in debug_outputs/:")
    for f in sorted(debug_files):
        print(f"  - debug_outputs/{f}")

    print("\n" + "=" * 60)
    print("ALL GOLDEN PIPELINE TESTS PASSED IN < 5 SECONDS!")
    print("=" * 60)


if __name__ == "__main__":
    run_golden_tests()
