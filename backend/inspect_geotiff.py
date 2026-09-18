import os
import sys

# Path to user's 14 GB GeoTIFF
tif_path = r"C:\Users\nisha\Downloads\SF5, SF6.tif"

print(f"Checking file: {tif_path}")
if not os.path.exists(tif_path):
    print(f"Error: File does not exist at {tif_path}")
    sys.exit(1)

size_gb = os.path.getsize(tif_path) / (1024**3)
print(f"File size on disk: {size_gb:.2f} GB")

try:
    import tifffile
    with tifffile.TiffFile(tif_path) as tif:
        print(f"Number of series / pages: {len(tif.pages)}")
        first_page = tif.pages[0]
        print(f"Dimensions: {first_page.shape} (Height x Width x Bands)")
        print(f"Data type: {first_page.dtype}")
        print(f"Compression: {first_page.compression}")
        print(f"Is tiled: {first_page.is_tiled}")
        if first_page.is_tiled:
            print(f"Tile shape: {first_page.tile_shape}")

        # Check for georeferencing tags
        geotags = {}
        for tag in first_page.tags:
            if tag.name.startswith("Geo") or "Model" in tag.name or "Spatial" in tag.name:
                geotags[tag.name] = tag.value
        print(f"Found {len(geotags)} geospatial metadata tags: {list(geotags.keys())}")

except Exception as e:
    print(f"tifffile failed, trying PIL: {e}")
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    with Image.open(tif_path) as img:
        print(f"Dimensions: {img.size} (Width x Height)")
        print(f"Bands: {img.mode}, Format: {img.format}")
