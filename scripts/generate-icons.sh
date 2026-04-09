#!/bin/bash
# Generate iOS app icons from favicon.png (1024x1024)

SOURCE="../favicon.png"
ICON_DIR="../ios/App/App/Assets.xcassets/AppIcon.appiconset"

cd "$(dirname "$0")"

# Create icon directory
mkdir -p "$ICON_DIR"

# iOS requires a single 1024x1024 icon now (Xcode 15+)
# But we'll generate the common sizes for compatibility
SIZES=(20 29 40 58 60 76 80 87 120 152 167 180 1024)

for size in "${SIZES[@]}"; do
  sips -z $size $size "$SOURCE" --out "$ICON_DIR/icon-${size}.png" > /dev/null 2>&1
  echo "  Generated: icon-${size}.png (${size}x${size})"
done

# Create Contents.json for the icon set
cat > "$ICON_DIR/Contents.json" << 'ICONJSON'
{
  "images": [
    {
      "filename": "icon-40.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "20x20"
    },
    {
      "filename": "icon-58.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "29x29"
    },
    {
      "filename": "icon-76.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "38x38"
    },
    {
      "filename": "icon-80.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "40x40"
    },
    {
      "filename": "icon-120.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "60x60"
    },
    {
      "filename": "icon-152.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "76x76"
    },
    {
      "filename": "icon-167.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "83.5x83.5"
    },
    {
      "filename": "icon-1024.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    }
  ],
  "info": {
    "author": "xcode",
    "version": 1
  }
}
ICONJSON

echo ""
echo "  App icons generated!"
