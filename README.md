# TAI - Web Build System

🌍 **[English](#english)** | **[日本語](#日本語)** | **[Tiếng Việt](#tiếng-việt)**

---

<h2 id="english">🇬🇧 English</h2>

A Node.js-based build system to compile EJS, SCSS, and optimize images. Supports building new template projects or updating existing client codebases.

## 1. Project Setup
1. **Requirements**: Node.js `v16.0.0` or higher.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Local Environment**:
   - Copy `.env.example` and rename it to `.env`.
   - Set your local web server path in `WEB_ROOT` (e.g., `D:\laragon\www`).
   - *Note: `.env` is ignored by Git and only applies to your local computer.*

## 2. CI/CD Configuration (`deploy-config.json`)
This file is committed to Git and dictates how the project behaves in CI/CD and acts as the default fallback locally.

```json
"env": {
  "MODE": "new",           // Set to "new" (uses EJS) or "renew" (no EJS, copies files exactly).
  "OUTPUT_EXT": "php",     // "php" or "html". Sets extension of compiled pages. 
  "RENEW_SCSS_DIR": "assets/scss", // (renew mode only) Path to SCSS relative to src/.
  "RENEW_CSS_DIR": "assets/css"    // (renew mode only) Output path relative to public/.
}
```
*Tip: `RENEW_SCSS_DIR` and `RENEW_CSS_DIR` support multiple paths separated by commas (e.g., `"PC/scss, SP/scss"` mapped to `"PC/css, SP/css"`).*

## 3. Working Modes

### A. New Project (`MODE="new"`)
Used to create a new layout from scratch using the EJS templating engine.
- **Pages**: Place `.ejs` files inside `src/pages/`. Use YAML frontmatter at the top to define layouts.
- **Components**: Place reusable parts prefixed with `_` inside `src/components/`. Call them using `<%- includeComponent('name') %>`.
- **Assets**: Put SCSS, JS, and image files in `src/pages/assets/`. JPG/PNG images auto-convert to WebP.
- **Output**: Generates `.php` or `.html` into the `public/` folder with proper indentation.

### B. Client Code Update (`MODE="renew"`)
Used when receiving an existing folder from a client. EJS is skipped.
- **Process**: Copy the client's entire folder structure directly into `src/`.
- **Output**: The entire `src/` is copied as-is into `public/`. SCSS files located in `RENEW_SCSS_DIR` will compile into CSS and output to `RENEW_CSS_DIR`.

## 4. Commands
- `npm run dev` : Starts local watcher & live-reload server.
- `npm run build` : Compiles production-ready files into `public/`.
- `npm run link` : Symlinks `public/` to your local `WEB_ROOT` for live server checking.
- `npm run clean` : Deletes the `public/` directory.

## 5. Deployment Workflow (GitHub Actions)
- **To Deploy to Staging**: Simply Git Push. The server auto-detects modified files, uploads the exact changes, and deletes any empty/unused folders.
- **To Send to Client**: Create and push a Git Tag (e.g., `v1.0.0`). A clean `.zip` file of the `public/` folder will be generated automatically in the GitHub Releases tab.

<br><br>

---

<h2 id="日本語">🇯🇵 日本語</h2>

Node.jsベースの静的サイトビルドシステムです。EJSとSCSSのコンパイル、画像の最適化を行います。新規構築と既存ソースの改修の両方をサポートします。

## 1. 環境構築
1. **必須要件**: Node.js `v16.0.0` 以上。
2. **依存関係のインストール**:
   ```bash
   npm install
   ```
3. **ローカル環境の設定**:
   - `.env.example` をコピーして `.env` にリネームします。
   - `WEB_ROOT` にローカルサーバーのパス（例: `D:\laragon\www`）を指定します。
   - *注意: `.env`ファイルはGitに無視され、ローカル自身の環境にのみ影響します。*

## 2. プロジェクト設定 (`deploy-config.json`)
このファイルはGitで管理され、サーバー（CI/CD）の動作を決定します。ローカルでもフォールバックとして優先されます。

```json
"env": {
  "MODE": "new",           // "new"（EJS使用） または "renew"（丸ごとコピー）。
  "OUTPUT_EXT": "php",     // 出力ファイルの拡張子。 "php" または "html"。
  "RENEW_SCSS_DIR": "assets/scss", // (renew時のみ) src/ からのSCSSパス。
  "RENEW_CSS_DIR": "assets/css"    // (renew時のみ) public/ からのCSS出力先。
}
```
*TIPS: `RENEW_SCSS_DIR` と `RENEW_CSS_DIR` はカンマ区切りで複数指定できます（例: `"PC/scss, SP/scss"`）。*

## 3. 作業モード

### A. 新規構築 (`MODE="new"`)
EJSエンジンを使用してゼロから構築する場合に使用します。
- **ページ**: `src/pages/` 内に `.ejs` ファイルを作成し、ファイル上部のYAML Frontmatterでレイアウトを定義します。
- **コンポーネント**: `src/components/` 内に `_` から始まるファイルを作成し、`<%- includeComponent('name') %>` で呼び出します。
- **アセット**: `src/pages/assets/` に SCSS, JS, 画像を配置します。JPG/PNGは自動でWebPに変換されます。
- **出力結果**: `public/` ディレクトリに整形済みの `.php` または `.html` がコンパイルされます。

### B. 既存ソース更新 (`MODE="renew"`)
クライアントから受け取った既存ソースを改修する場合に使用します。EJS機能は無効になります。
- **手順**: クライアントのソースコード構成をそのまま `src/` ディレクトリ直下にコピーします。
- **出力結果**: `src/` の内容がそのまま `public/` にコピーされます。ただし `RENEW_SCSS_DIR` で指定したSCSSファイルのみコンパイルされて出力されます。

## 4. 実行コマンド
- `npm run dev` : 開発サーバー（ライブリロード・監視）を起動します。
- `npm run build` : `public/` に本番用ファイルをビルドします。
- `npm run link` : `public/` ディレクトリをローカルの `WEB_ROOT` へシンボリックリンクします。
- `npm run clean` : `public/` ディレクトリを削除します。

## 5. デプロイ手順（GitHub Actions）
- **Stagingサーバーへのデプロイ**: Git Pushするだけです。変更されたファイルのみが検知・アップロードされ、不要な空ディレクトリは自動削除されます。
- **納品ファイルの作成**: Gitタグ（例: `v1.0.0`）を作成してPushすると、自動でメタデータが除去され、GitHubのReleasesに納品用クリーンZIPが生成されます。

<br><br>

---

<h2 id="tiếng-việt">🇻🇳 Tiếng Việt</h2>

Hệ thống Build Website dựa trên Node.js dùng để biên dịch EJS, SCSS và chuyển đổi ảnh. Hỗ trợ 2 dạng: code dựng mới hoàn toàn từ mẫu hoặc gắn code cũ của khách hàng vào để sửa SCSS.

## 1. Cài Đặt Ban Đầu
1. **Yêu Cầu**: Cài đặt sẵn Node.js bản `v16.0.0` trở lên.
2. **Cài đặt thư viện**:
   ```bash
   npm install
   ```
3. **Cài đặt file local**:
   - Copy file `.env.example` và đổi tên thành `.env`.
   - Sửa dòng `WEB_ROOT` thành đường dẫn phần mềm máy chủ ảo trên máy bạn (VD: `D:\laragon\www`).
   - *Lưu ý: File `.env` không đẩy lên Git, nó chỉ có tác dụng cấu hình trên máy tính cá nhân của bạn.*

## 2. Cài Đặt Dự Án (`deploy-config.json`)
File này đẩy lên Git. Nó quyết định dự án này sẽ build theo chế độ nào trên Server CI/CD.

```json
"env": {
  "MODE": "new",           // Nhập "new" (để dùng EJS) hoặc "renew" (copy tịnh tiến).
  "OUTPUT_EXT": "php",     // Định dạng file xuất ra "php" hoặc "html".
  "RENEW_SCSS_DIR": "assets/scss", // (chỉ dành cho renew) Đường dẫn chứa SCSS ở trong src/.
  "RENEW_CSS_DIR": "assets/css"    // (chỉ dành cho renew) Nơi xuất CSS ra trong public/.
}
```
*Mẹo: `RENEW_SCSS_DIR` và `RENEW_CSS_DIR` hỗ trợ khai báo nhiều đường dẫn bằng dấu phẩy (VD: `"PC/scss, SP/scss"` -> `"PC/css, SP/css"`).*

## 3. Cách Bắt Đầu Căn Bản

### A. Dự Án Xây Mới (`MODE="new"`)
Dùng khi bạn làm 1 project layout HTML từ đầu.
- **Trang (Pages)**: Tạo file `.ejs` bên trong `src/pages/`. Dùng hệ thống YAML Frontmatter ở đầu file để gọi bố cục (Header/Footer).
- **Phân Khúc (Components)**: Đặt các file bắt đầu bằng dấu `_` vào bộ `src/components/`. Dùng lệnh `<%- includeComponent('name') %>` để gọi nó vào page ở bất kỳ độ sâu nào.
- **Tài Nguyên (Assets)**: Đưa SCSS, JS và Hình ảnh vào thư mục cấu trúc `src/pages/assets/`. Ảnh tĩnh sẽ bị bắt convert mạnh sang WebP.
- **Đầu ra**: Xuất gọn gàng ra thư mục `public/` với code được auto-format thẳng thớm lề lối.

### B. Chỉnh Sửa Dựa Trên Cấu Trúc Khách Hàng (`MODE="renew"`)
Dùng khi khách quăng 1 tệp HTML có sẵn cấu trúc rối rắm. Disable toàn bộ EJS.
- **Cách làm**: Ném sạch đống code khách cho vào thẳng thư mục `src/`.
- **Đầu ra**: Nó sẽ clone 1:1 qua mục `public/`. Hệ thống chỉ nhúng tay vào việc quét và biên dịch SCSS đã khai báo trong config ở trên.

## 4. Các Lệnh Thao Tác
- `npm run dev` : Khởi động trình theo dõi file, tự chạy Browsersync auto reload.
- `npm run build` : Gói và Build toàn bộ Source ra mục `public/`.
- `npm run link` : Tự động nối dây (Symlink) rọn ràng từ thư mục `public/` qua server nội bộ (XAMPP/Laragon) để test.
- `npm run clean` : Cắt bỏ mục `public/`.

## 5. Quy Trình Deploy Git Automation (GitHub Actions)
- **Build Lên Môi Trường Test (Staging)**: Chỉ cần Git Push. Hệ thống rà từng file, có khác mới tải lên (rất nhanh). Xóa tự động mọi thư mục trống rác mà bạn lỡ bỏ quên đi.
- **Bàn Giao Dự Án**: Gắn tag (VD: `v1.0.0`) vào branch và Push. Lập tức một file ZIP dọn dẹp sạch sẽ metadata rác sẽ được tống lên tab "Releases" của GitHub, gửi link cho PM là xong.
