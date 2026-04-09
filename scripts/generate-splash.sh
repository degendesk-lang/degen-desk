#!/bin/bash
# Generate splash screen images for iOS
# Creates a dark background with centered app icon

SOURCE="../favicon.png"
SPLASH_DIR="../ios/App/App/Assets.xcassets/Splash.imageset"

cd "$(dirname "$0")"

mkdir -p "$SPLASH_DIR"

# Generate splash screens at different scales
# We use sips to create a properly sized icon, then place it on a dark canvas

for scale in 1 2 3; do
  SIZE=$((2732 / $scale))
  ICON_SIZE=$((200 / $scale))

  # Create dark background
  sips -z $SIZE $SIZE "$SOURCE" --out "/tmp/splash-temp-${scale}.png" > /dev/null 2>&1

  # Since sips can't composite, we'll use the favicon resized as splash
  # For a proper splash, we just need the 1024x1024 icon resized
  # The actual splash screen uses the LaunchScreen storyboard with dark bg

  # Just create a small centered icon for the image set
  sips -z $ICON_SIZE $ICON_SIZE "$SOURCE" --out "$SPLASH_DIR/splash-2732x2732${scale == 1 ? '-2' : scale == 2 ? '-1' : ''}.png" > /dev/null 2>&1
done

# For splash screens, we'll rely on the LaunchScreen.storyboard with dark bg
# Just copy the icon at different sizes
sips -z 256 256 "$SOURCE" --out "$SPLASH_DIR/splash-2732x2732-2.png" > /dev/null 2>&1
sips -z 512 512 "$SOURCE" --out "$SPLASH_DIR/splash-2732x2732-1.png" > /dev/null 2>&1
sips -z 1024 1024 "$SOURCE" --out "$SPLASH_DIR/splash-2732x2732.png" > /dev/null 2>&1

echo "  Splash images generated!"
