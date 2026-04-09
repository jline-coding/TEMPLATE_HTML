# TAI - Web Build System

🌍 **[English](#english)** | **[日本語](#日本語)** | **[Tiếng Việt](#tiếng-việt)**

---

<h2 id="english">🇬🇧 English</h2>

A Node.js build system to compile EJS, SCSS, and optimize images. Supports building new templates or cleanly updating existing client codebases.

## 1. Installation
1. **Requirements**: Node.js `v20.0.0` or higher.
2. **Install dependecies**:
   ```bash
   npm install
   ```
3. **Local Setup** (Do not skip):
   - Copy `.env.example` and rename it to `.env`.
   - Set your local web server path in `WEB_ROOT` (e.g., `D:\laragon\www`).
   - If using PHP, set `SERVER_TYPE` (e.g., `laragon`, `xampp`).
   - *Note: `.env` is ignored by Git and only affects your local computer.*

## 2. Workflows (How to setup and run)

### Case 1: Build a Pure HTML Website (`new html`)
Use this to build standard static HTML pages from EJS components.
1. **Config**: Open `deploy-config.json` and set:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "html",
   "USE_PHP_INCLUDE": "false"
   ```
2. **Code**: Write your layout logic in `src/pages/`.
3. **Run**: Execute `npm run dev`. BrowserSync will open a static local server and auto-reload.
4. **Finish**: Execute `npm run build`. Grab the final output from the `public/` folder.

---

### Case 2: Build a PHP Website (Single File) (`new php`)
Use this to compile EJS into `.php` files but KEEP the layouts (like header/footer) injected natively into the single file.
1. **Config**: Open `deploy-config.json` and set:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "php",
   "USE_PHP_INCLUDE": "false"
   ```
2. **Code**: Write in `src/pages/`. You can inject PHP syntax directly inside your EJS.
3. **Link**: Ensure Laragon/XAMPP is on. Run `npm run link` to connect `public/` to your server.
4. **Run**: Execute `npm run dev`. 

---

### Case 3: Build a PHP Website (Modular) (`new php INCLUDE`)
**Recommended for CMS/WordPress projects.** Compiles EJS to PHP, but strictly isolates components into physical files and uses `<?php include ?>`.
1. **Config**: Open `deploy-config.json` and set:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "php",
   "USE_PHP_INCLUDE": "true"
   ```
2. **Code**: Create components starting with `_` inside `src/components/`.
3. **Run**: Execute `npm run link`, then `npm run dev`. The system will automatically construct the component hierarchy in `public/`.

---

### Case 4: Edit Existing Client Code (`renew`)
Use this when you receive an old client folder and only want to compile their SCSS without migrating them to EJS.
1. **Config**: Open `deploy-config.json` and set `"MODE": "renew"`.
2. **Paths**: Open your local `.env` file and set the exact SCSS routes (commas allowed):
   ```env
   RENEW_SCSS_DIR=PC/scss, SP/scss
   RENEW_CSS_DIR=PC/css, SP/css
   ```
3. **Code**: Paste the client's entire folder into `src/` (replacing what's there).
4. **Run**: Execute `npm run dev`. Code bypasses EJS entirely and statically copies over, whilst actively compiling SCSS.

## 3. GitHub Deployments
- **Deploy to Staging**: Run `git push`. GitHub Actions runs a differential analysis and securely uploads only modified files to staging.
- **Client Delivery**: Create and push a Git Tag (e.g., `v1.0.0`). GitHub Actions skips FTP and generates a clean Production `.zip` inside the "Releases" tab.

<br><br>

---

<h2 id="日本語">🇯🇵 日本語</h2>

EJSとSCSSのコンパイル、画像の最適化を行うNode.jsビルド環境です。新規テンプレートの構築から既存顧客ソースの改修まで、運用に合わせて明確にスケールします。

## 1. インストール
1. **必須環境**: Node.js `v20.0.0` 以上。
2. **依存関係のインストール**:
   ```bash
   npm install
   ```
3. **ローカル設定** (必須):
   - `.env.example` をコピーし、`.env` にリネームします。
   - `WEB_ROOT` にローカルサーバーの公開フォルダ（例: `D:\laragon\www`）を指定します。
   - PHPを使用する場合は、`SERVER_TYPE`（例: `laragon`）を設定します。

## 2. ワークフロー（各ケースの実行手順）

### ケース 1: 静的HTMLサイトの構築 (`new html`)
EJSコンポーネントから一般的な静的HTMLをビルドします。
1. **設定**: `deploy-config.json` を開いて以下のように設定します:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "html",
   "USE_PHP_INCLUDE": "false"
   ```
2. **コーディング**: `src/pages/` 内で作業を行います。
3. **実行**: `npm run dev` を実行します。静的なローカルサーバーが立ち上がり、変更を監視します。
4. **完了**: `npm run build` を実行し、`public/` フォルダの静的ファイルを取得します。

---

### ケース 2: PHPサイトの構築・単一ファイル (`new php`)
EJSを`.php`としてビルドしますが、ヘッダー等のレイアウトは抽出せず、一つのファイルに直接インジェクトしたままにします。
1. **設定**: `deploy-config.json` にて以下を設定します:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "php",
   "USE_PHP_INCLUDE": "false"
   ```
2. **コーディング**: `src/pages/` 内で記述します。EJS内にPHP構文を混在できます。
3. **リンク**: Laragon/XAMPPを起動させ、`npm run link` を実行して `public/` をサーバーにシンボリックリンクします。
4. **実行**: `npm run dev` を実行します。PHPプロキシ経由でライブリロードが稼働します。

---

### ケース 3: PHPサイトの構築・モジュール分割 (`new php INCLUDE`)
**CMSや大規模案件で推奨。** コンポーネントを独立した物理ファイルとして分離出力し、動的に `<?php include ?>` で呼び出します。
1. **設定**: `deploy-config.json` にて以下を設定します:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "php",
   "USE_PHP_INCLUDE": "true"
   ```
2. **コーディング**: `src/components/` の中に `_` から始まるコンポーネントを作成します。
3. **実行**: `npm run link` の後に `npm run dev` を実行します。出力先に自動でモジュール構造が形成されます。

---

### ケース 4: 既存クライアント案件の改修 (`renew`)
クライアントから受け取った既存のソースコード群に対し、EJS等の環境を変えることなく、SCSS環境のみを付与したい場合に使用します。
1. **設定**: `deploy-config.json` で `"MODE": "renew"` を設定します。
2. **パス指定**: ローカルの `.env` ファイルに、改修予定のSCSSディレクトリを指定します（複数指定可）:
   ```env
   RENEW_SCSS_DIR=PC/scss, SP/scss
   RENEW_CSS_DIR=PC/css, SP/css
   ```
3. **データ配置**: `src/` の中身を一旦空にし、クライアントから受け取ったフォルダ構造をそのまま配置します。
4. **実行**: `npm run dev` を実行します。SCSSはコンパイルされ、その他のファイルは1対1で忠実にコピー・監視されます。

## 3. GitHub デプロイ
- **テスト環境へのデプロイ**: `git push` を実行。変更されたファイルのみが検知され、安全にStaging環境にFTP転送されます。
- **クライアント納品**: Git Tag（例: `v1.0.0`）を作成してPushします。`public/` の内容のみが抽き出されたクリーンな `.zip` ファイルが、GitHubのReleasesに自動生成されます。

<br><br>

---

<h2 id="tiếng-việt">🇻🇳 Tiếng Việt</h2>

Hệ thống Build Tĩnh dùng để biên dịch EJS, SCSS và tối ưu ảnh. Phân luồng hoạt động rạch ròi từ việc xây dự án HTML mới đến việc đôn đốc SCSS cho đống code cũ của khách hàng.

## 1. Cài Đặt Đầu Tiên
1. **Yêu cầu**: Cài đặt sẵn Node.js `v20.0.0` trở lên.
2. **Cài Packages**:
   ```bash
   npm install
   ```
3. **Setup Local** (Bắt buộc không bỏ qua):
   - Copy file `.env.example` và đổi tên thành `.env`.
   - Cài đường dẫn thư mục công khai của Laragon/Xampp vào dòng `WEB_ROOT` (VD: `D:\laragon\www`).
   - Nếu dự án dính dáng tới PHP, hãy ghi rõ dòng `SERVER_TYPE` (VD: `laragon`).
   - *Lưu ý: File `.env` chỉ cấu hình riêng cho máy bạn, không bị đẩy lên Git.*

## 2. Hướng Dẫn Thực Hành 4 Trường Hợp

### Trường hợp 1: Code Trang HTML Thuần (`new html`)
Mục đích: Viết code EJS chia nhỏ ra nhưng khi xuất thì rập khuôn thành 1 file `.html` cứng tĩnh.
1. **Cấu hình**: Mở `deploy-config.json` và set:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "html",
   "USE_PHP_INCLUDE": "false"
   ```
2. **Code**: Viết giao diện bên trong mục `src/pages/`.
3. **Chạy**: Gõ `npm run dev`. Máy sẽ tự mở cổng localhost nội bộ và auto-reload.
4. **Xong**: Gõ `npm run build` để tối ưu hóa code và chốt hạ sản phẩm trong mục `public/`.

---

### Trường hợp 2: Code Trang PHP Nguyên Tảng (`new php`)
Mục đích: Biến EJS thành đuôi `.php` (để dùng hàm PHP bên trong) nhưng bắt buộc Layout Header/Footer phải đổ trực tiếp HTML thô tháp vào 1 file duy nhất.
1. **Cấu hình**: Mở `deploy-config.json` và set:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "php",
   "USE_PHP_INCLUDE": "false"
   ```
2. **Code**: Viết giao diện bên trong `src/pages/`. Bạn có thể chèn code PHP loạn xạ ở đây.
3. **Link Server**: Bật sẵn Laragon/Xampp. Gõ `npm run link` để hệ thống thông ống mục `public/` sang máy chủ của bạn qua Symlink.
4. **Chạy**: Gõ `npm run dev` để bắt đầu code PHP với hot reload.

---

### Trường hợp 3: Code PHP Lắp Ráp Cắt Lớp (`new php INCLUDE`)
**Bắt buộc dùng cho đội làm CMS/WordPress**. Cắt phăng Header/Footer ra thành các file tách rời tự động trong `public/components` và nhúng nối tiếp thông qua mã `<?php include ?>`.
1. **Cấu hình**: Mở `deploy-config.json` và set:
   ```json
   "MODE": "new",
   "OUTPUT_EXT": "php",
   "USE_PHP_INCLUDE": "true"
   ```
2. **Code**: Tạo file Header có dấu gạch `_` đằng trước và bỏ vào `src/components/`. 
3. **Chạy**: Gõ `npm run link`, sau đó gõ `npm run dev`. Code chạy, chia chác thư mục đâu vào đấy.

---

### Trường hợp 4: Nối Source Cũ Khách Giao (`renew`)
Mục đích: Khách quăng qua 1 bộ Source lộn xộn. Bạn chỉ việc viết lại CSS cho nó thông qua SCSS mà không đụng chạm tới nền EJS.
1. **Cấu hình**: Mở `deploy-config.json` và set `"MODE": "renew"`.
2. **Chỉ đường**: Ở file `.env` Local của máy bạn, bạn hãy nhắm mục tiêu thư mục SCSS. Hỗ trợ phẩy đa mục tiêu để code PC và SP độc lập:
   ```env
   RENEW_SCSS_DIR=PC/scss, SP/scss
   RENEW_CSS_DIR=PC/css, SP/css
   ```
3. **Nhét Code**: Xóa hết rác rưởi khởi tạo mặc định trong mục `src/`, ném cục tảng thư mục gốc của khách vào y chang `src/`.
4. **Chạy**: Gõ `npm run dev`. Quá trình copy dập khuôn từ trong ra ngoài (vẫn auto-reload CSS) bắt đầu.

## 3. Lệnh Đóng Gói Lên Server Bằng Git
- **Gửi bản Test lên Staging**: Gõ `git push`. Server trên không trung của Github sẽ săm soi mã SHA, bóc tách ra ĐÚNG chỉ file nào bạn vừa bấm sửa để upload lên, đồng thời xóa luôn thư mục rác nếu lỡ có.
- **Tạo bản ZIP Gửi Khách (Production)**: Khoanh vùng Release bằng cách tạo Tag bản quyền (VD: `v1.0.0`) và bấm Push Tag lên Git. Tab "Releases" trên Repo tự động đẻ ra 1 file Nén Zip nhẹ gọn trong sạch cho khách download.
