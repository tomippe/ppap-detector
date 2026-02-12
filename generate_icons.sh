#!/bin/bash

# PPAP Referencer - Icon Generator
# Requires ImageMagick (brew install imagemagick)

mkdir -p icons

# SVGアイコンを作成
cat > icons/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4CAF50"/>
      <stop offset="100%" style="stop-color:#2E7D32"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="128" height="128" rx="20" fill="url(#bg)"/>
  <!-- Lock icon -->
  <rect x="38" y="52" width="52" height="44" rx="4" fill="#fff"/>
  <path d="M48 52V40c0-9 7-16 16-16s16 7 16 16v12" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
  <!-- Key dots -->
  <circle cx="64" cy="72" r="6" fill="#2E7D32"/>
  <rect x="61" y="72" width="6" height="14" rx="2" fill="#2E7D32"/>
  <!-- P letters -->
  <text x="18" y="115" font-family="Arial Black" font-size="24" fill="rgba(255,255,255,0.3)">P</text>
  <text x="95" y="115" font-family="Arial Black" font-size="24" fill="rgba(255,255,255,0.3)">P</text>
</svg>
EOF

# PNG各サイズを生成
if command -v convert &> /dev/null; then
  convert -background none icons/icon.svg -resize 16x16 icons/icon16.png
  convert -background none icons/icon.svg -resize 48x48 icons/icon48.png
  convert -background none icons/icon.svg -resize 128x128 icons/icon128.png
  echo "Icons generated successfully!"
else
  echo "ImageMagick not found. Please install it:"
  echo "  brew install imagemagick"
  echo ""
  echo "Or manually create PNG icons from icons/icon.svg"
fi
