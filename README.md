# TAI - Web Build System

🌍 **[English](#english)** | **[日本語](#日本語)** | **[Tiếng Việt](#tiếng-việt)**

---

<h2 id="english">🇬🇧 English</h2>

A Node.js-based build system designed to compile EJS, SCSS, and optimize images. It scales dynamically based on your project requirements—from simple static HTML pages to modular PHP CMS structures, to raw client-code renewals.

## 1. Project Setup
1. **Requirements**: Node.js `v16.0.0` or higher.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Local Environment**:
   - Copy `.env.example` and rename it to `.env`.
   - Set your local web server path in `WEB_ROOT` (e.g., `D:\laragon\www`).
   - Set your `SERVER_TYPE` (e.g., `laragon`, `mamp`, `xampp`) if you plan to use PHP.
   - *Note: `.env` is ignored by Git. It is your personal local configuration.*

## 2. CI/CD & Project Configuration (`deploy-config.json`)
The `deploy-config.json` determines how the project compiles. Below are the 4 fundamental use-cases you will face in production. Choose the configuration that matches your scenario.

---

### Case 1: Pure HTML Output (`new html`)
Use this for simple landing pages or purely static websites. No server logic is required.

**Configuration (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "html",
  "USE_PHP_INCLUDE": "false"
}
```
- **How it works**: EJS components (like `_header.ejs`) are hard-coded/injected directly into the final `.html` output files.
- **Local Dev**: `npm run dev` boots up a standard static BrowserSync server.

---

### Case 2: PHP Output - Single File (`new php`)
Use this if you need `.php` extensions (e.g., to write inline PHP logic inside your EJS) but you want the final HTML structure to remain consolidated in one file rather than split across multiple component files.

**Configuration (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "php",
  "USE_PHP_INCLUDE": "false"
}
```
- **How it works**: EJS components are injected as raw HTML code into the output `.php` file.
- **Local Dev**: Requires a local server (Laragon/XAMPP). BrowserSync will automatically proxy through `http://localhost/YOUR_FOLDER` to parse the PHP.

---

### Case 3: PHP Output - Modular Includes (`new php INCLUDE`)
**Recommended for Large/CMS Projects.** Use this when the backend team requires headers, footers, and sidebars to be physically separated into their own `.php` files for WordPress or framework integration.

**Configuration (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "php",
  "USE_PHP_INCLUDE": "true"
}
```
- **How it works**: Files inside `src/components/` are physically generated into `public/components/*.php`. In your generated pages (like `index.php`), the system automatically writes `<?php include($assetsDir . 'components/header.php'); ?>` instead of printing raw HTML.

---

### Case 4: Client Code Renewal (`renew`)
Use this when a client hands you their existing source code, and you simply need to fix bugs or update CSS without migrating their entire structure into EJS.

**Configuration (`deploy-config.json`)**:
```json
"env": {
  "MODE": "renew"
}
```
**Local `.env` Configuration**:
```env
RENEW_SCSS_DIR=assets/scss
RENEW_CSS_DIR=assets/css
```
*(You can compile multiple directories separated by commas: `RENEW_SCSS_DIR=PC/scss, SP/scss`)*

- **How it works**: The EJS engine is completely disabled. You copy the client's raw folder directly into `src/`. The build script mirrors `src/` to `public/` 1:1, but actively compiles SCSS located in `RENEW_SCSS_DIR` matching it to `RENEW_CSS_DIR`.

---

## 3. Basic Commands
- `npm run dev` : Starts file watcher and live-reload server.
- `npm run build` : Minifies and compiles production-ready files into `public/`.
- `npm run link` : Creates an OS-level symlink connecting your `public/` folder to your actual local web server folder (defined in `.env` as `WEB_ROOT`).
- `npm run clean` : Deletes the `public/` directory.

## 4. Deployment Workflow (GitHub Actions)
- **Deploy to Staging**: Run `git push`. The server analyzes file hashes, safely uploads ONLY the modified files via FTP, and recursively deletes any empty/obsolete folders.
- **Deliver Final Project**: Create a Git Tag (e.g., `v1.0.0`) and push. A clean `.zip` file without developer metadata will automatically attach itself to the GitHub Releases page.

<br><br>

---

<h2 id="日本語">🇯🇵 日本語</h2>

Node.jsベースのビルドシステムで、EJS、SCSSのコンパイル、および画像の最適化を行います。単純な静的HTMLページから、モジュール化されたPHPのCMS構造、既存ソースコードの修正まで、要件に応じて動的にスケールします。

## 1. 環境構築
1. **必須要件**: Node.js `v16.0.0` 以上。
2. **依存関係のインストール**:
   ```bash
   npm install
   ```
3. **ローカル環境の設定**:
   - `.env.example` をコピーして `.env` にリネームします。
   - `WEB_ROOT` にローカルサーバーのパス（例: `D:\laragon\www`）を指定します。
   - PHPを使用する場合は、`SERVER_TYPE`（例: `laragon`, `mamp`など）を設定します。
   - *注意: `.env`ファイルはGitに無視されます。個人のローカル環境用です。*

## 2. CI/CDとプロジェクト設定 (`deploy-config.json`)
プロジェクトのビルド方法は `deploy-config.json` によって決定されます。実際の業務で想定される **4つのユースケース** は以下の通りです。

---

### ケース 1: 完全なHTML出力 (`new html`)
LP（ランディングページ）や完全に静的なWebサイト用です。

**設定 (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "html",
  "USE_PHP_INCLUDE": "false"
}
```
- **仕組み**: EJSコンポーネント（ヘッダー等）は、出力される最終的な `.html` ファイルに直接ハードコード（インジェクト）されます。
- **ローカル開発**: `npm run dev`で標準の静的BrowserSyncサーバーが起動します。

---

### ケース 2: PHP出力 - 単一ファイル展開 (`new php`)
ページ内で独自のPHPロジックを書きたいが、パーツごとにファイルを分割せず、HTML構造をメインのファイルに集約させたい場合に使用します。

**設定 (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "php",
  "USE_PHP_INCLUDE": "false"
}
```
- **仕組み**: 出力される `.php` ファイルの中に、コンポーネントのHTMLが直接インジェクトされます。
- **ローカル開発**: ローカルサーバー（Laragon等）が必要です。BrowserSyncが自動的にプロキシを作成しPHPを解析させます。

---

### ケース 3: PHP出力 - モジュール分割 (`new php INCLUDE`)
**大規模サイト・CMS向け推奨。** Web制作やバックエンド側の要請で、ヘッダー・フッターを別々のファイルとして分け、メインファイルからそれを呼び出す構造（WordPress向けなど）に最適です。

**設定 (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "php",
  "USE_PHP_INCLUDE": "true"
}
```
- **仕組み**: `src/components/` 内のファイルは物理的に `public/components/*.php` として生成されます。メインページ（`index.php`等）の中には、生のHTMLではなく `<?php include($assetsDir . 'components/header.php'); ?>` というコードが自動記述されます。

---

### ケース 4: クライアント既存ソース改修 (`renew`)
クライアントから既存のソースコード（HTML/PHPなど）一式を渡され、単純にCSS（SCSS）の修正などを追加依頼された場合に使用します。EJSへの移行は不要です。

**設定 (`deploy-config.json`)**:
```json
"env": {
  "MODE": "renew"
}
```
**ローカル `.env` 設定**:
```env
RENEW_SCSS_DIR=assets/scss
RENEW_CSS_DIR=assets/css
```
*(カンマ区切りで複数ディレクトリを指定可能です: `RENEW_SCSS_DIR=PC/scss, SP/scss`)*

- **仕組み**: EJSエンジンは無効化されます。`src/` の内容が1対1でそのまま `public/` にコピーされますが、`RENEW_SCSS_DIR` にあるSCSSファイルのみコンパイルされて指定先に出力されます。

---

## 3. 基本コマンド
- `npm run dev` : 開発サーバー（ライブリロード・監視）を起動します。
- `npm run build` : `public/` に本番用ファイルをビルドします。
- `npm run link` : `public/` ディレクトリを、ローカルサーバーの公開フォルダ（`WEB_ROOT`）にシンボリックリンクします。
- `npm run clean` : `public/` ディレクトリを一掃します。

## 4. デプロイ手順（GitHub Actions）
- **Staging環境へデプロイ**: `git push` を実行します。サーバーは変更されたファイルのみを検知してFTPで安全に自動転送し、不要な空のディレクトリなどをクリーンアップします。
- **納品用ファイルの作成**: Gitタグ（例: `v1.0.0`）を作成しPushします。余計なメタデータを排除したクリーンなZIPファイルがGitHubのReleases画面に自動生成されます。

<br><br>

---

<h2 id="tiếng-việt">🇻🇳 Tiếng Việt</h2>

Hệ thống Core Build Tĩnh bằng Node.js, cho phép biên dịch EJS, SCSS và đóng gói ảnh. Khả năng tùy chỉnh cực cao cho mọi tình huống thực tế: từ build trang Landing Page HTML nội khu, tới cắt HTML/PHP theo mảng nhỏ cho việc ráp CMS, hay nhận dự án code thuần của khách hàng để sửa lỗi giao diện. 

## 1. Cài Đặt Ban Đầu
1. **Yêu Cầu**: Cài đặt sẵn Node.js bản `v16.0.0` trở lên.
2. **Cài đặt thư viện**:
   ```bash
   npm install
   ```
3. **Cài đặt môi trường cá nhân**:
   - Copy file `.env.example` và đổi tên thành `.env`.
   - Sửa dòng `WEB_ROOT` thành đường dẫn phần mềm máy chủ ảo trên máy bạn (VD: `D:\laragon\www`).
   - Sửa `SERVER_TYPE` nếu bạn định dùng Code PHP (VD: `laragon`, `xampp`).
   - *Lưu ý: File `.env` là file cá nhân, không đẩy lên Git.*

## 2. Các Trường Hợp Khởi Tạo Dự Án (`deploy-config.json`)
File `deploy-config.json` chi phối toàn bộ phương thức build của Git. Dưới đây là **4 tình huống bắt buộc phải nắm rõ** khi làm dự án thực tế. Hãy chọn Config ứng với dự án của bạn:

---

### Trường hợp 1: Build Web HTML Thuần (`new html`)
Dùng cho làm các file tĩnh, Landing Page cơ bản không có nhu cầu chèn vòng lặp PHP hay nhúng server. 

**Cấu hình (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "html",
  "USE_PHP_INCLUDE": "false"
}
```
- **Cách hoạt động**: Các mảnh ghép EJS (như Header, Footer) sẽ được ép/paste text trực tiếp vào bên trong file `.html` cuối cùng.
- **Local làm việc**: Lệnh `npm run dev` sẽ tự bật Live-Reload dưới dạng Server Tĩnh, không cần mở XAMPP hay Laragon.

---

### Trường hợp 2: Build Web PHP Nguyên Tảng (`new php`)
Dùng trong trường hợp dự án ép dùng đuôi `.php` (VD để code các biến `$title` inline) nhưng bạn vẫn muốn source sau khi build chỉ nằm gọn trong 1 file `index.php` mà không bị phân rã thành nhiều file ruột.

**Cấu hình (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "php",
  "USE_PHP_INCLUDE": "false"
}
```
- **Cách hoạt động**: Header, Footer EJS đều được đổ trực tiếp đè vào file `.php` xuất ra.
- **Local làm việc**: BẮT BUỘC cần Local Server. BrowserSync sẽ tự tạo Proxy để phiên dịch PHP trên `http://localhost/YOUR_FOLDER`.

---

### Trường hợp 3: Build Web PHP Lắp Ráp (`new php INCLUDE`)
**Đề xuất dùng cho các Hệ thống lớn/Giao code cho Đội Backend/WordPress.** Backend luôn yêu cầu phải cắt Header, Footer thành các file riêng lẻ để họ tiện cấu hình đường dẫn nội bộ.

**Cấu hình (`deploy-config.json`)**:
```json
"env": {
  "MODE": "new",
  "OUTPUT_EXT": "php",
  "USE_PHP_INCLUDE": "true"
}
```
- **Cách hoạt động**: Build Engine tự động tách mọi file trong `src/components/` xuất thành các trạm `.php` riêng ở `public/components/`. Thay vì chèn code thô, tự động nó sẽ nhét lệnh `<?php include($assetsDir . 'components/header.php'); ?>` vào móng của file gọi nó. 

---

### Trường hợp 4: Chỉnh Sửa Code Của Khách Cũ (`renew`)
Trường hợp khách ném cho bạn 1 kho Source HTML hỗn độn cổ xưa. Họ chỉ yêu cầu bạn viết thêm CSS/SCSS hoặc chỉnh sửa Text. Đây là lúc sử dụng biến này.

**Cấu hình (`deploy-config.json`)**:
```json
"env": {
  "MODE": "renew"
}
```
**File `.env` bạn tự cấu hình trên máy**:
```env
RENEW_SCSS_DIR=assets/scss
RENEW_CSS_DIR=assets/css
```
*(Bạn có thể quét đa thư mục nếu source khách phức tạp: `RENEW_SCSS_DIR=PC/scss, SP/scss`)*

- **Cách hoạt động**: EJS biến mất. Hệ thống clone 100% nguyên bản toàn bộ file trong `src/` ném thẳng thừng qua `public/`, ngoại trừ việc nó vẫn liên tục nhận diện và tự compile gọn gàng các file SCSS nằm ở `RENEW_SCSS_DIR`. 

---

## 3. Lệnh Thao Tác Cơ Bản
- `npm run dev` : Khởi động trình theo dõi file, tự chạy Browsersync auto reload.
- `npm run build` : Gói và Build làm đẹp thẳng thớm ra mục `public/`.
- `npm run link` : Tự động nối dây (Symlink) từ thư mục `public/` qua server nội bộ theo đường dẫn `WEB_ROOT` trong file env để test Live.
- `npm run clean` : Cắt bỏ mục `public/`.

## 4. Quy Trình Trả Kết Quả Bằng Git (GitHub Actions)
- **Deploy Lên Môi Trường Test**: Cứ gõ lệnh `git push` như bình thường. Action sẽ dò được file sửa, file mới và đẩy lên Staging Server chuẩn xác, đồng thời bóc gỡ sạch cấu trúc đường dẫn rỗng ở nhánh gốc.
- **Bàn Giao Dự án Cuối**: Gắn tag bản quyền (VD: `v1.0.0`) vào code nhánh chính rồi Push, Bot sẽ đóng gói thư mục `public/` thành ZIP - cạo sạch mọi rác metadata nội bộ `.DS_Store` hay `.deploy_manifest`. Mở Tab GitHub Releases tải về và gửi PM.

<br><br>

---

*Written securely with meticulous precision.*
