#!/bin/bash
set -e

# ===== PPAP Detector ビルドスクリプト (Chrome拡張) =====

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="ppap-detector"
ZIP_NAME="${APP_NAME}.zip"

# 共通スクリプト読み込み
source "$SCRIPT_DIR/../build-common/version.sh"

# バージョン読み込み
VERSION=$(version_read)

echo "🔧 ${APP_NAME} v${VERSION} をビルド中..."

# manifest.json にバージョンを埋め込み
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" manifest.json
echo "  ✓ manifest.json を v${VERSION} に更新しました"

# content.js のバージョンを更新
sed -i '' "s/Content Script v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*/Content Script v$VERSION/" content.js 2>/dev/null || true
echo "  ✓ content.js を更新しました"

# content.css のバージョンを更新
sed -i '' "s/Styles v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*/Styles v$VERSION/" content.css 2>/dev/null || true
echo "  ✓ content.css を更新しました"

# popup.html のバージョンを更新
if [ -f "popup/popup.html" ]; then
    sed -i '' "s/Version [0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*/Version $VERSION/" popup/popup.html 2>/dev/null || true
    echo "  ✓ popup/popup.html を更新しました"
fi

# zip作成
rm -f "$ZIP_NAME"
zip -r "$ZIP_NAME" . \
    -x "*.git*" \
    -x "*.DS_Store" \
    -x "*.zip" \
    -x "*.sh" \
    -x "version.txt" \
    -x "icons/*.svg" \
    -x "icons/original.*" \
    -x "README.md" \
    -x ".gitignore"

echo ""
echo "✅ ${ZIP_NAME} (v${VERSION}) を作成しました"
echo "📦 場所: $(pwd)/${ZIP_NAME}"

# 次回用バージョン保存
echo ""
echo "📝 次回用バージョンを更新しています..."
version_save_next "$VERSION"
