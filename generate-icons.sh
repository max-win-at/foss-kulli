#!/bin/bash
# Icon Generation Script for Foss Kulli PWA
# Requires: ImageMagick (convert command) or Inkscape
# Run: chmod +x generate-icons.sh && ./generate-icons.sh

ICON_DIR="icons"
SRC_ICON="$ICON_DIR/icon.svg"
SRC_MASKABLE="$ICON_DIR/icon-maskable.svg"

# Standard icon sizes for PWA
SIZES=(72 96 128 144 152 192 384 512)

echo "Generating PWA icons..."

# Check for ImageMagick
if command -v convert &> /dev/null; then
    CONVERTER="imagemagick"
elif command -v inkscape &> /dev/null; then
    CONVERTER="inkscape"
else
    echo "Please install ImageMagick or Inkscape to generate PNG icons"
    echo "On Ubuntu/Debian: sudo apt install imagemagick"
    echo "On macOS: brew install imagemagick"
    exit 1
fi

for SIZE in "${SIZES[@]}"; do
    OUTPUT="$ICON_DIR/icon-${SIZE}x${SIZE}.png"
    
    if [ "$CONVERTER" = "imagemagick" ]; then
        convert -background none -density 300 "$SRC_ICON" -resize ${SIZE}x${SIZE} "$OUTPUT"
    else
        inkscape "$SRC_ICON" -w $SIZE -h $SIZE -o "$OUTPUT"
    fi
    
    echo "Created: $OUTPUT"
done

# Generate maskable icons
for SIZE in 192 512; do
    OUTPUT="$ICON_DIR/icon-maskable-${SIZE}x${SIZE}.png"
    
    if [ "$CONVERTER" = "imagemagick" ]; then
        convert -background none -density 300 "$SRC_MASKABLE" -resize ${SIZE}x${SIZE} "$OUTPUT"
    else
        inkscape "$SRC_MASKABLE" -w $SIZE -h $SIZE -o "$OUTPUT"
    fi
    
    echo "Created: $OUTPUT (maskable)"
done

# Generate shortcut icon
OUTPUT="$ICON_DIR/shortcut-new.png"
if [ "$CONVERTER" = "imagemagick" ]; then
    convert -background none -density 300 "$ICON_DIR/shortcut-new.svg" -resize 96x96 "$OUTPUT"
else
    inkscape "$ICON_DIR/shortcut-new.svg" -w 96 -h 96 -o "$OUTPUT"
fi
echo "Created: $OUTPUT (shortcut)"

# Generate Apple Touch Icon (180x180)
OUTPUT="$ICON_DIR/apple-touch-icon.png"
if [ "$CONVERTER" = "imagemagick" ]; then
    convert -background none -density 300 "$SRC_ICON" -resize 180x180 "$OUTPUT"
else
    inkscape "$SRC_ICON" -w 180 -h 180 -o "$OUTPUT"
fi
echo "Created: $OUTPUT (Apple Touch Icon)"

# Generate favicon
OUTPUT="$ICON_DIR/favicon-32x32.png"
if [ "$CONVERTER" = "imagemagick" ]; then
    convert -background none -density 300 "$SRC_ICON" -resize 32x32 "$OUTPUT"
else
    inkscape "$SRC_ICON" -w 32 -h 32 -o "$OUTPUT"
fi
echo "Created: $OUTPUT"

OUTPUT="$ICON_DIR/favicon-16x16.png"
if [ "$CONVERTER" = "imagemagick" ]; then
    convert -background none -density 300 "$SRC_ICON" -resize 16x16 "$OUTPUT"
else
    inkscape "$SRC_ICON" -w 16 -h 16 -o "$OUTPUT"
fi
echo "Created: $OUTPUT"

# Generate ICO file for legacy support
if [ "$CONVERTER" = "imagemagick" ]; then
    convert "$ICON_DIR/favicon-16x16.png" "$ICON_DIR/favicon-32x32.png" "$ICON_DIR/favicon.ico"
    echo "Created: $ICON_DIR/favicon.ico"
fi

echo ""
echo "Icon generation complete!"
echo "Don't forget to copy favicon.ico to the root directory if needed."
