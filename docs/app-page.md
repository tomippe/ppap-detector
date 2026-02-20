# PPAP Detector 紹介ページ設定

## キャッチフレーズ（app-cp）

PPAPメールを開くとパスワードを自動表示
Gmailで使える

## KV背景・キー色

- **app-kvbg**: `docs/kv-bg.png` を WordPress メディアにアップロードし、メディアIDを設定
- **app-keycolor**: `#e8b945`
- **app-kvbgaddcss**: `background-repeat: no-repeat; background-position: center; background-size: cover; background-blend-mode: multiply;`
- **ブレンドモード**: multiply

## その他 ACF

- **app-icon**: `icons/icon128.png` を WordPress メディアにアップロードし、app-icon にメディアIDを設定
- **app-weburl**: https://chromewebstore.google.com/detail/ppap-detector/jbfidmhjaniebpgogkkahcdjepllenhk
- **app-webdesc**: Chrome 拡張機能（インストールボタンラベル）
- **platform**: `["web"]`
- **app-ss01**: メディアID 1803（593x371、Playwrightでキャプチャ）

## 実施済み

- WordPress 紹介ページ作成（ID: 1799、スラッグ: ppap-detector）
- `.env` 設定（WP_APP_POST_ID, WP_APP_PAGE_URL）
- 本文・ACF 設定済み
