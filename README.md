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
   - *(Optional)* If using PHP, set `WEB_ROOT` (e.g., `D:\laragon\www`) and `PROXY_URL` (e.g., `http://localhost/template_html`).
   - *Note: `.env` is ignored by Git. Also, `WEB_ROOT` automatically adapts across OS (Windows/Mac/Linux). The `npm run link` command securely generates native system paths without requiring Administrator permissions.*

## 2. Workflows (How to setup and run)

### Case 1: Build a Pure HTML Website (`new html`)
Use this to build standard static HTML pages from EJS components.
1. **Config**:
   - `deploy-config.json`: Set `"MODE": "new"`, `"OUTPUT_EXT": "html"`, `"USE_PHP_INCLUDE": "false"`.
   - `.env`: **Not required.** `WEB_ROOT` & `PROXY_URL` can be left blank.
2. **Code**: Write your development logic inside the `src/` folder.
- **🚀 Quick Execution**: `npm run dev` ➔ `npm run build` *(when finished)*

---

### Case 2: Build a PHP Website (Single File) (`new php`)
Use this to compile EJS into `.php` files but KEEP the layouts (like header/footer) injected natively into the single file.
1. **Config**:
   - `deploy-config.json`: Set `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "false"`.
   - `.env`: **Mandatory.** Set your `WEB_ROOT` and `PROXY_URL` for the PHP proxy to work.
2. **Code**: Write inside the `src/` folder. You can inject PHP syntax directly inside your EJS.
- **🚀 Quick Execution**: Start Local Server ➔ `npm run link` *(once)* ➔ `npm run dev` ➔ `npm run build` *(when finished)*

---

### Case 3: Build a PHP Website (Modular) (`new php INCLUDE`)
**Recommended for CMS/WordPress projects.** Compiles EJS to PHP, but strictly isolates components into physical files and uses `<?php include ?>`.
1. **Config**:
   - `deploy-config.json`: Set `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "true"`.
   - `.env`: **Mandatory.** Set your `WEB_ROOT` and `PROXY_URL` for the PHP proxy to work.
2. **Code**: Create components starting with `_` inside `src/components/`.
- **🚀 Quick Execution**: Start Local Server ➔ `npm run link` *(once)* ➔ `npm run dev` ➔ `npm run build` *(when finished)*

---

### Case 4: Edit Existing Client Code (HTML) (`renew html`)
Use this when you receive an old client folder containing `.html` files and only want to compile their SCSS. No local server proxy needed.
1. **Config**:
   - `deploy-config.json`: Set `"MODE": "renew"`, `"OUTPUT_EXT": "html"`.
   - `.env`: **No server vars needed.** Just declare target folders for SCSS compilation (commas allowed to declare multiple):
     ```env
     # Example (1 or multiple folders allowed):
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **Code**: Delete **EVERYTHING** inside the `src/` folder, then upload the client's entire source code directly into `src/`.
3. **SCSS Integration**: Create your SCSS folder anywhere inside the uploaded `src/` structure, and ensure `RENEW_SCSS_DIR` and `RENEW_CSS_DIR` in `.env` are updated to point to those exact relative paths.
- **🚀 Quick Execution**: `npm run dev` ➔ `npm run build` *(when finished)*

---

### Case 5: Edit Existing Client Code (PHP) (`renew php`)
Use this when you receive an old client folder containing `.php` files (like WordPress themes) and want to compile their SCSS. Requires Proxy.
1. **Config**:
   - `deploy-config.json`: Set `"MODE": "renew"`, `"OUTPUT_EXT": "php"`.
   - `.env`: **Mandatory.** Set your `WEB_ROOT` and `PROXY_URL`. Additionally, declare target folders for SCSS compilation (commas allowed):
     ```env
     # Example (1 or multiple folders allowed):
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **Code**: Delete **EVERYTHING** inside the `src/` folder, then upload the client's entire source code directly into `src/`.
3. **SCSS Integration**: Create your SCSS folder anywhere inside the uploaded `src/` structure, and ensure `RENEW_SCSS_DIR` and `RENEW_CSS_DIR` in `.env` are updated to point to those exact relative paths.
- **🚀 Quick Execution**: Start Local Server ➔ `npm run link` *(once)* ➔ `npm run dev` ➔ `npm run build` *(when finished)*

## 3. Quick Command Summary
- **HTML Sites (Cases 1 & 4)**: `npm run dev` ➔ `npm run build`
- **PHP Sites (Cases 2, 3 & 5)**: Start Local Server ➔ `npm run link` *(once)* ➔ `npm run dev` ➔ `npm run build`

## 4. Upload to Environments & Production
The system uses GitHub Actions to automate branch-based deployments via FTP.

### ⚙️ How to configure the Environments:
1. **GitHub Secrets**: Go to `Settings > Secrets and variables > Actions`. Based on your `"server"` value in `deploy-config.json` (e.g., `"JLWEB"`), create a strictly named Secret formatted as `[SERVER]_CONFIG` (Example: `JLWEB_CONFIG`) containing this exact JSON structure:
   ```json
   {
     "host": "ftp.example.com",
     "user": "ftp_username",
     "pass": "ftp_password",
     "ftp_dir": "./public_html/client/github_deploy",
     "root_path": "/home/web-jline/public_html/client/github_deploy"
   }
   ```
   *Explanation of fields:*
   - `"host"`: Your FTP server address.
   - `"user"` / `"pass"`: FTP login credentials.
   - `"ftp_dir"`: The relative path connecting to the FTP server endpoint.
   - `"root_path"`: The absolute physical path on the hosting server (used for generating `.htaccess` absolute paths).
2. **`deploy-config.json`**: Open `deploy-config.json` to configure target directories and authentication for each branch:
   ```json
   "test": {
     "deploy_method": "ftp",
     "server": "JLWEB",
     "project_dir": "template_jline_html",
     "basic_auth": { "username": "test", "password": "test" }
   },
   "production": {
     "deploy_method": "ftp",
     "server": "JLWEB",
     "project_dir": "template_jline_html_production"
   }
   ```
   *Notes on Configuration:*
   *- Declaring `"basic_auth"` alongside an `"ftp"` deploy method will automatically generate `.htaccess` and `.htpasswd` (Basic Authentication) to protect the target server directory.*
   *- **Fallback ZIP Mode**: If the client does not provide an FTP server for Production deployments, change `"deploy_method"` to `"zip"`. The action will skip FTP operations entirely and generate a standalone `.zip` fallback inside GitHub Releases (the `"server"` attribute is then not required).*
     ```json
     "production": {
       "deploy_method": "zip",
       "project_dir": "template_jline_html_production"
     }
     ```

### 🚀 Execution Commands (Terminal or GUI):
- **Upload to Test Environment**: 
  - **Terminal**: Commit changes and run `git push origin staging`.
  - **Git GUI (SourceTree/GitHub Desktop)**: Switch to the `staging` branch, commit your files, and click "Push".
- **Upload to Production Server**: 
  - **Terminal**: Commit changes and run `git push origin master`.
  - **Git GUI**: Switch to the `master` branch, commit your files, and click "Push".
- **Generate Production ZIP (Client Delivery)**: 
  - **Terminal**: Run `git tag v1.0.0` then `git push origin v1.0.0`.
  - **Git GUI**: Right-click your latest commit, select "Add Tag" (name it `v1.0.0`), and ensure "Push Tags" is selected when pushing. 
  *(A clean `.zip` asset will automatically appear inside the GitHub "Releases" tab).*

> ⚠️ **IMPORTANT BRANCH NAMING**: The GitHub Actions workflow is currently hardcoded to listen for pushes strictly on the `staging` and `master` branches. If you wish to use alternative branch names (such as `test` or `main`), you MUST manually update the `on: push: branches:` trigger inside the `.github/workflows/deploy.yml` file.

## 5. Teamwork & Git Branching Strategy
When working with multiple developers, follow this Git Flow to prevent code conflicts and keep deployments safe.

### 🌳 Branch Roles:
1. **`master`**: The strictly protected **Production** source of truth. Only client-approved code lives here.
2. **`staging`**: The **Test/Integration** branch. This acts as the central integration environment for Reviewers/QC. Code gets merged here collectively so the team can verify it on the Test Server.
3. **`feature/*`** (e.g., `feature/header`, `fix/bugs`): **Working branches**. All coding happens here.

### 🔄 Standard Workflow:
1. **Branch Out**: Always create a new branch from `master` (e.g., `git checkout -b feature/about-page`).
2. **Develop**: Write your code and test locally using `npm run dev`.
3. **Push to Staging (Test)**: Merge your feature branch into `staging`, then push `staging`. Actions will upload it to the Test Server.
4. **Push to Master (Production)**: Once the client approves the test server, merge your feature branch directly into `master`. Push `master` to fire the Production deployment.

> ⚠️ **CRITICAL RULE**: Do **NOT** merge the `staging` branch entirely into `master`. `staging` often contains untested code from other developers. Always merge your specific `feature/*` branch directly into `master`!

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
   - *(任意)* PHPを使用する場合は、ローカルサーバーの公開フォルダを `WEB_ROOT` に、サーバーURLを `PROXY_URL` に設定してください（例: `http://localhost/template_html`）。
   - *注意: `.env`ファイルはGitに無視されます。さらに、`WEB_ROOT` はOS（Windows/Mac/Linux）に自動適応するため、`npm run link` コマンドは管理者権限なしでも安全なネイティブショートカットを自動生成します。*

## 2. ワークフロー（各ケースの実行手順）

### ケース 1: 静的HTMLサイトの構築 (`new html`)
EJSコンポーネントから一般的な静的HTMLをビルドします。
1. **設定**: 
   - `deploy-config.json`: `"MODE": "new"`, `"OUTPUT_EXT": "html"`, `"USE_PHP_INCLUDE": "false"` を指定します。
   - `.env`: **不要です。** `WEB_ROOT` と `PROXY_URL` は空白のままで問題ありません。
2. **コーディング**: `src/` フォルダ内で作業を行います。
- **🚀 実行フロー**: `npm run dev` 実行 ➔ `npm run build` *(完成時)*

---

### ケース 2: PHPサイトの構築・単一ファイル (`new php`)
EJSを`.php`としてビルドしますが、ヘッダー等のレイアウトは抽出せず、一つのファイルに直接インジェクトしたままにします。
1. **設定**: 
   - `deploy-config.json`: `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "false"` を指定します。
   - `.env`: **必須です。** PHPプロキシを動作させるため、`WEB_ROOT` と `PROXY_URL` を設定してください。
2. **コーディング**: `src/` フォルダ内で記述します。EJS内にPHP構文を混在できます。
- **🚀 実行フロー**: ローカルサーバー起動 ➔ `npm run link` *(初回のみ)* ➔ `npm run dev` 実行 ➔ `npm run build` *(完成時)*

---

### ケース 3: PHPサイトの構築・モジュール分割 (`new php INCLUDE`)
**CMSや大規模案件で推奨。** コンポーネントを独立した物理ファイルとして分離出力し、動的に `<?php include ?>` で呼び出します。
1. **設定**:
   - `deploy-config.json`: `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "true"` を指定します。
   - `.env`: **必須です。** PHPプロキシを動作させるため、`WEB_ROOT` と `PROXY_URL` を設定してください。
2. **コーディング**: `src/` フォルダ内で記述します。
- **🚀 実行フロー**: ローカルサーバー起動 ➔ `npm run link` *(初回のみ)* ➔ `npm run dev` 実行 ➔ `npm run build` *(完成時)*

---

### ケース 4: 既存クライアント案件の改修 (静的HTML) (`renew html`)
クライアントの既存HTMLソースを受け取り、SCSSのみをコンパイルする場合に使用します（ローカルサーバーは不要です）。
1. **設定**:
   - `deploy-config.json`: `"MODE": "renew"`, `"OUTPUT_EXT": "html"` を指定します。
   - `.env`: **サーバー設定は不要です。** コンパイル対象のSCSSディレクトリのみを指定します（複数ある場合はカンマ区切り）:
     ```env
     # 記述例（単一または複数フォルダ対応）:
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **データ配置**: `src/` フォルダの中身を**すべて削除**し、クライアントのソースコードをそのまま `src/` に配置します。
3. **SCSSの統合**: アップロードした `src/` 構造内の任意の場所にSCSSフォルダを作成し、`.env` の `RENEW_SCSS_DIR` と `RENEW_CSS_DIR` がその相対パスと正確に一致するように設定してください。
- **🚀 実行フロー**: `npm run dev` 実行 ➔ `npm run build` *(完成時)*

---

### ケース 5: 既存クライアント案件の改修 (PHP案件) (`renew php`)
クライアントの既存PHPソース（WordPress等）を受け取り、SCSSをコンパイルする場合に使用します（PHPプロキシ必須です）。
1. **設定**:
   - `deploy-config.json`: `"MODE": "renew"`, `"OUTPUT_EXT": "php"` を指定します。
   - `.env`: **必須です。** プロキシ用に `WEB_ROOT` と `PROXY_URL` を設定し、さらにコンパイル対象のSCSSディレクトリを指定します:
     ```env
     # 記述例（単一または複数フォルダ対応）:
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **データ配置**: `src/` フォルダの中身を**すべて削除**し、クライアントのソースコードをそのまま `src/` に配置します。
3. **SCSSの統合**: アップロードした `src/` 構造内の任意の場所にSCSSフォルダを作成し、`.env` の `RENEW_SCSS_DIR` と `RENEW_CSS_DIR` がその相対パスと正確に一致するように設定してください。
- **🚀 実行フロー**: ローカルサーバー起動 ➔ `npm run link` *(初回のみ)* ➔ `npm run dev` 実行 ➔ `npm run build` *(完成時)*

## 3. コマンド早見表（各ケース別）
- **静的HTML (ケース 1 & 4)**: `npm run dev` 実行 ➔ 完成時に `npm run build`
- **動的PHP (ケース 2, 3 & 5)**: ローカルサーバー起動 ➔ `npm run link` 実行 (初回のみ) ➔ `npm run dev` 実行 ➔ 完成時に `npm run build`

## 4. 各環境へのアップロード ＆ 本番納品
システムは GitHub Actions を使用してブランチベースのFTPデプロイを自動化します。

### ⚙️ 環境の設定方法:
1. **GitHub Secrets**: `Settings > Secrets and variables > Actions` に移動します。`deploy-config.json` 内の `"server"` に指定した値（例: `"JLWEB"`）に基づき、`[サーバー名]_CONFIG` という名前のシークレット（例: `JLWEB_CONFIG`）を作成し、以下のJSONを入力します:
   ```json
   {
     "host": "ftp.example.com",
     "user": "ftp_username",
     "pass": "ftp_password",
     "ftp_dir": "./public_html/client/github_deploy",
     "root_path": "/home/web-jline/public_html/client/github_deploy"
   }
   ```
   *各項目の説明:*
   - `"host"`: FTPサーバーアドレス.
   - `"user"` / `"pass"`: FTPログイン情報.
   - `"ftp_dir"`: FTPエンドポイントの相対ディレクトリパス.
   - `"root_path"`: サーバー上の物理絶対パス（`.htaccess`ファイルのフルパス指定等で使用します）.
2. **`deploy-config.json`**: 各ブランチのターゲットディレクトリと認証を設定します:
   ```json
   "test": {
     "deploy_method": "ftp",
     "server": "JLWEB",
     "project_dir": "template_jline_html",
     "basic_auth": { "username": "test", "password": "test" }
   },
   "production": {
     "deploy_method": "ftp",
     "server": "JLWEB",
     "project_dir": "template_jline_html_production"
   }
   ```
   *注意:*
   *- `"ftp"` メソッドで `"basic_auth"` を設定すると、自動的に `.htaccess` と `.htpasswd` が生成されサーバーにベーシック認証がかかります。*
   *- **ZIP納品モード**: 本番環境の納品でクライアントがFTPサーバーを提供しない場合は、`"deploy_method"` を `"zip"` に変更してください。FTP通信をスキップし、独立した納品用ZIPファイルのみをGitHub Releasesに生成します（この場合 `"server"` 指定は不要です）。*
     ```json
     "production": {
       "deploy_method": "zip",
       "project_dir": "template_jline_html_production"
     }
     ```

### 🚀 実行手順 (ターミナルまたはGUI経由):
- **テスト環境へのアップロード**: 
  - **ターミナル**: 変更をコミットし、`git push origin staging` を実行します。
  - **Git GUI (SourceTree / GitHub Desktop)**: `staging` ブランチに切り替え、コミットして「Push」をクリックします。
- **本番環境へのアップロード (Production)**: 
  - **ターミナル**: 変更をコミットし、`git push origin master` を実行します。
  - **Git GUI**: `master` ブランチに切り替え、コミットして「Push」をクリックします。
- **納品用 ZIP の自動生成 (Git Tag)**: 
  - **ターミナル**: `git tag v1.0.0` を実行し、`git push origin v1.0.0` を実行します。
  - **Git GUI**: 最新のコミットを右クリックして「タグを追加」（例: `v1.0.0`）を選択し、タグを含めてPushします。
  *(GitHub の「Releases」タブ内にクリーンな納品用 `.zip` ファイルが自動生成されます).*

> ⚠️ **ブランチ名に関する重要事項**: GitHub Actions のワークフローは、デフォルトで `staging` および `master` ブランチへのPushを検知するようハードコードされています。`test` や `main` などの独自のブランチ名を使用する場合は、必ず `.github/workflows/deploy.yml` 内のトリガー設定（`on: push: branches:`）を修正してください。

## 5. チーム開発とGitブランチ戦略
複数人で開発する場合、コンフリクトを防ぎ、安全にデプロイするために以下の Git Flow を推奨します。

### 🌳 ブランチの役割:
1. **`master`**: 完全に保護された **本番環境 (Production)** ブランチ。クライアントが承認した完成コードのみを含みます。
2. **`staging`**: **テスト・統合** ブランチ。ここはレビュアーやQC（品質管理）向けの統合環境として機能します。メンバーそれぞれのコードがここに集約され、テストサーバー上で動作確認が行われます。
3. **`feature/*`** (例: `feature/header`, `fix/bugs`): **作業ブランチ**。全てのコーディング作業をここで行います。

### 🔄 標準ワークフロー:
1. **ブランチの作成**: 常に `master` から新しい作業ブランチを作成します（例: `git checkout -b feature/about-page`）。
2. **開発**: コードを記述し、ローカル環境（`npm run dev`）で確認します。
3. **Stagingへ統合 (テストアップ)**: 作業ブランチを `staging` にマージし、`staging` をPushします。テストサーバーに変更が反映されます。
4. **Masterへ統合 (本番アップ)**: クライアントの承認が下りたら、作業ブランチを `master` にマージしてPushします。本番環境へ反映されます。

> ⚠️ **超重要ルール**: `staging` ブランチをそのまま `master` にマージしてはいけません。`staging` には他の開発者の未完成コードが混ざっている可能性があります。必ず**個別の `feature/*` ブランチ**を `master` にマージしてください！

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
   - *(Tùy chọn)* Nếu làm dự án PHP, hãy điền đường dẫn thư mục ảo vào dòng `WEB_ROOT` và link local vào dòng `PROXY_URL` (VD: `http://localhost/template_html`).
   - *Lưu ý: File `.env` sẽ không bị đẩy lên Git. Hơn nữa, biến `WEB_ROOT` tương thích hoàn toàn trên đa hệ điều hành (Windows/Mac/Linux). Lệnh ảo hóa `npm run link` tự động nhận diện và tạo Shortcut chuẩn native mà không bao giờ đòi hỏi các quyền Administrator.*

## 2. Hướng Dẫn Thực Hành Các Trường Hợp

### Trường hợp 1: Code Trang HTML Thuần (`new html`)
Mục đích: Viết code EJS chia nhỏ ra nhưng khi xuất thì rập khuôn thành 1 file `.html` cứng tĩnh.
1. **Cấu hình**: 
   - `deploy-config.json`: Hãy set `"MODE": "new"`, `"OUTPUT_EXT": "html"`, `"USE_PHP_INCLUDE": "false"`.
   - `.env`: **Ngó lơ/Không cần điền.** Bạn không cần quan tâm đến `WEB_ROOT` hay `PROXY_URL` ở trường hợp này.
2. **Code**: Thực hiện code và quản lý giao diện bên trong thư mục `src/`.
- **🚀 Lệnh Khởi Chạy Nhanh**: Gõ `npm run dev` ➔ Gõ `npm run build` *(khi chốt dự án)*

---

### Trường hợp 2: Code Trang PHP Nguyên Tảng (`new php`)
Mục đích: Biến EJS thành đuôi `.php` (để dùng hàm PHP bên trong) nhưng bắt buộc Layout Header/Footer phải đổ trực tiếp HTML thô tháp vào 1 file duy nhất.
1. **Cấu hình**: 
   - `deploy-config.json`: Hãy set `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "false"`.
   - `.env`: **BẮT BUỘC ĐIỀN.** Phải điền chính xác `WEB_ROOT` và `PROXY_URL` để tạo ống dẫn Proxy PHP mượt mà.
2. **Code**: Trực tiếp sửa đổi source gốc bên trong thư mục `src/`. Bạn có thể chèn code PHP loạn xạ ở đây.
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo ➔ Gõ `npm run link` *(chỉ 1 lần)* ➔ Gõ `npm run dev` ➔ Gõ `npm run build` *(khi chốt dự án)*

---

### Trường hợp 3: Code PHP Lắp Ráp Cắt Lớp (`new php INCLUDE`)
**Bắt buộc dùng cho đội làm CMS/WordPress**. Cắt phăng Header/Footer ra thành các file tách rời tự động trong `public/components` và nhúng nối tiếp thông qua mã `<?php include ?>`.
1. **Cấu hình**: 
   - `deploy-config.json`: Hãy set `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "true"`.
   - `.env`: **BẮT BUỘC ĐIỀN.** Giống mục trên, phải điền chính xác `WEB_ROOT` và `PROXY_URL` để Proxy hiểu đường truyền.
2. **Code**: Thực hiện code và quản lý giao diện bên trong thư mục `src/`.
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo ➔ Gõ `npm run link` *(chỉ 1 lần)* ➔ Gõ `npm run dev` ➔ Gõ `npm run build` *(khi chốt dự án)*

---

### Trường hợp 4: Nối Source Khách Hàng (Tĩnh HTML) (`renew html`)
Mục đích: Khách giao một bộ Source thuần đuôi `.html`. Bạn chỉ việc viết SCSS cho dự án. Cỡ này không cần bật ảo hóa Proxy.
1. **Cấu hình**: 
   - `deploy-config.json`: Hãy set `"MODE": "renew"`, `"OUTPUT_EXT": "html"`.
   - `.env`: **Không cần điền Server.** Chỉ cần khai báo thêm mục tiêu dịch SCSS (Hỗ trợ phẩy đa mục tiêu để code PC và SP độc lập):
     ```env
     # Ví dụ minh họa (Hỗ trợ 1 hoặc nhiều thư mục nhánh):
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **Code**: Xóa **toàn bộ** mọi thứ hiện có trong thư mục `src/`, sau đó upload nguyên vẹn source code của khách hàng vào thẳng thư mục `src/`.
3. **Tích hợp SCSS**: Tự do tạo mới thư mục SCSS ở bất kỳ vị trí nào bên trong cục source khách vừa ném vào `src/`. Chỉ cần đảm bảo khai báo đường dẫn `RENEW_SCSS_DIR` và đích xuất `RENEW_CSS_DIR` trong `.env` khớp chính xác với vị trí đó là được.
- **🚀 Lệnh Khởi Chạy Nhanh**: Gõ `npm run dev` ➔ Gõ `npm run build` *(khi chốt dự án)*

---

### Trường hợp 5: Nối Source Khách Hàng (Động PHP) (`renew php`)
Mục đích: Khách giao Source chứa đuôi `.php` (như WordPress CMS). Bắt buộc phải gắn thông ống Proxy ra Server ảo để Terminal Watch CSS hiển thị được mã PHP trực tiếp trên BrowserSync.
1. **Cấu hình**: 
   - `deploy-config.json`: Hãy set `"MODE": "renew"`, `"OUTPUT_EXT": "php"`.
   - `.env`: **BẮT BUỘC ĐIỀN.** Khai báo chính xác `WEB_ROOT` và `PROXY_URL` giống như Case trên. Kèm theo đó khai báo mục tiêu dịch SCSS:
     ```env
     # Ví dụ minh họa (Hỗ trợ 1 hoặc nhiều thư mục nhánh):
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **Code**: Xóa **toàn bộ** mọi thứ hiện có trong thư mục `src/`, sau đó upload nguyên vẹn source code của khách hàng vào thẳng thư mục `src/`.
3. **Tích hợp SCSS**: Tự do tạo mới thư mục SCSS ở bất kỳ vị trí nào bên trong cục source khách vừa ném vào `src/`. Chỉ cần đảm bảo khai báo đường dẫn `RENEW_SCSS_DIR` và đích xuất `RENEW_CSS_DIR` trong `.env` khớp chính xác với vị trí đó là được.
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo ➔ Gõ `npm run link` *(chỉ 1 lần)* ➔ Gõ `npm run dev` ➔ Gõ `npm run build` *(khi chốt dự án)*

## 3. Bảng Tổng Hợp Lệnh Chạy Nhanh Trọn Bộ 5 Trường Hợp
- **Nhóm HTML Tĩnh (Trường hợp 1 & 4)**: Gõ `npm run dev` ➔ Xong dự án gõ `npm run build`
- **Nhóm PHP Động (Trường hợp 2, 3 & 5)**: Bật Server ➔ Gõ `npm run link` *(chỉ làm 1 lần)* ➔ Gõ `npm run dev` ➔ Xong dự án gõ `npm run build`

## 4. Lệnh Đóng Gói Lên Môi Trường Test & Production
Hệ thống sử dụng GitHub Actions để tự động hóa quy trình Deploy FTP hoàn toàn theo nhánh.

### ⚙️ Cách cấu hình môi trường:
1. **GitHub Secrets**: Vào mục `Settings > Secrets and variables > Actions`. Dựa theo tên bạn đặt ở mục `"server"` trong `deploy-config.json` (VD: `"JLWEB"`), hãy tạo một hàm biến Secret theo đúng cú pháp `[TÊN-SERVER]_CONFIG` (Ví dụ: `JLWEB_CONFIG`). Value bên trong nhúng nguyên 1 khối JSON sau:
   ```json
   {
     "host": "ftp.example.com",
     "user": "ftp_username",
     "pass": "ftp_password",
     "ftp_dir": "./public_html/client/github_deploy",
     "root_path": "/home/web-jline/public_html/client/github_deploy"
   }
   ```
   *Giải thích thông số JSON:*
   - `"host"`: Địa chỉ truy cập máy chủ FTP.
   - `"user"` / `"pass"`: Tài khoản và Mật khẩu FTP.
   - `"ftp_dir"`: Đường dẫn trỏ tới thư mục đích trên cây FTP.
   - `"root_path"`: Đường dẫn vật lý tuyệt đối trên thân máy chủ (Bắt buộc phải chuẩn xác vì dùng để cấp phát mã đường dẫn cho file khóa bảo mật `.htaccess`).
2. **`deploy-config.json`**: Truy cập file này để cấu hình thông số Server và Tên thư mục dự án cho từng nhánh:
   ```json
   "test": {
     "deploy_method": "ftp",
     "server": "JLWEB",
     "project_dir": "template_jline_html",
     "basic_auth": { "username": "test", "password": "test" }
   },
   "production": {
     "deploy_method": "ftp",
     "server": "JLWEB",
     "project_dir": "template_jline_html_production"
   }
   ```
   *Ghi chú quan trọng:*
   *- Nếu khai báo block `"basic_auth"` kèm giao thức `ftp`, hệ thống sẽ TỰ ĐỘNG sinh ra 2 file `.htaccess` và `.htpasswd` đính kèm khi upload để khóa thư mục bảo mật bằng mật khẩu.*
   *- **Tùy chọn Bàn Giao Zip**: Trường hợp lên Production mà khách hàng không cung cấp máy chủ FTP, bạn hãy thay đổi giá trị `"deploy_method": "zip"`. Khi Push code, hệ thống sẽ bỏ qua toàn bộ bước kết nối FTP và chỉ tự động Build một file `.zip` sạch sẽ ném vào tab GitHub Releases (lúc này bạn hoàn toàn có thể xóa bỏ dòng `"server"` đi để đỡ lỗi).*
     ```json
     "production": {
       "deploy_method": "zip",
       "project_dir": "template_jline_html_production"
     }
     ```

### 🚀 Lệnh thực thi (Bằng Terminal hoặc App GUI):
- **Upload môi trường Test (Staging)**: 
  - **Dùng Terminal lệnh**: Commit code và gõ `git push origin staging`.
  - **Dùng App (SourceTree / GitHub Desktop)**: Chuyển qua nhánh `staging`, ấn Commit và bấm nút "Push".
- **Upload môi trường Production**: 
  - **Dùng Terminal lệnh**: Commit code và gõ `git push origin master`.
  - **Dùng App**: Chuyển qua nhánh `master`, ấn Commit và bấm nút "Push".
- **Tạo bản ZIP Bàn Giao Khách (Dùng Git Tag)**:
  - **Dùng Terminal lệnh**: Gõ `git tag v1.0.0` sau đó gõ lệnh đẩy tag `git push origin v1.0.0`.
  - **Dùng App**: Bấm chuột phải vào nhánh hiện tại chọn "Add Tag" (đặt tên `v1.0.0` v.v...) và đảm bảo tích chọn "Push Tags" khi bấm Push.
  *(Hệ thống sẽ ngay lập tức tự đẻ ra 1 file Nén `.zip` sạch sẽ trong tab "Releases" trên kho GitHub).*

> ⚠️ **CẢNH BÁO QUAN TRỌNG VỀ TÊN NHÁNH (BRANCH)**: Hệ thống GitHub Actions đang được cấu hình mặc định chỉ kích hoạt tự động với 2 nhánh mang tên chính xác là `staging` và `master`. Nếu bạn muốn đổi tên nhánh (ví dụ: dùng nhánh `test` thay cho `staging`, hoặc nhánh `main` thay cho `master`), bạn BẮT BUỘC phải mở file `.github/workflows/deploy.yml` lên và sửa tên nhánh tương ứng ở khu vực trigger (`on: push: branches:`).

## 5. Quy Trình Làm Việc Nhóm & Quản Lý Nhánh (Git Flow)
Khi dự án có nhiều lập trình viên cùng tham gia, hãy tuân thủ mô hình phân nhánh sau để tránh giẫm đạp code và gây kẹt Server.

### 🌳 Vai trò các nhánh (Branches):
1. **`master`**: Nhánh **Production** hoàn hảo và bất khả xâm phạm. Chỉ chứa code đã chốt và bàn giao.
2. **`staging`**: Nhánh **Test Server/Integration**. Đây là môi trường tổng hợp (Integration) dành riêng cho Reviewer/QC kiểm thử. Mọi người merge code vào đây để review chéo và đưa cho sếp/khách hàng xem chung trên môi trường Test.
3. **`feature/*`** (VD: `feature/header`, `fix/footer`): Nhánh **Làm việc độc lập**. Toàn bộ thời gian code của bạn phải nằm ở các nhánh nhỏ này.

### 🔄 Luồng làm việc chuẩn mực:
1. **Tạo nhánh mới**: Luôn chẻ nhánh code mới bắt nguồn từ nhánh `master` (VD gõ lệnh: `git checkout -b feature/about-page`).
2. **Code & Chạy Local**: Viết code và tự xem trước dưới máy tính cục bộ bằng lệnh `npm run dev`.
3. **Gửi code lên Server Test**: Cập nhật nhánh nhánh `staging` bằng cách gộp nhánh (merge) `feature` của bạn vào nhánh `staging`. Sau đó gọi thao tác Push nhánh `staging`. Hệ thống hành động sẽ tải tự động cục code lên thư mục Test.
4. **Gửi code lên Server Thật (Production)**: Khi khách duyệt bản Test ok, bạn quay lại nhánh `feature` ban nãy gộp thẳng vào nhánh `master` và Push `master` lên (Gộp xong bạn có thể xóa nhánh feature đi cho nhẹ máy). 

> ⚠️ **LUẬT THÉP**: **TUYỆT ĐỐI KHÔNG** merge nguyên cục nhánh `staging` vào nhánh `master`. Nhánh `staging` rất "tạp nham" chứa cả những đoạn code làm dở của đồng nghiệp. Phải tập thói quen: Tính năng nào khách duyệt, lấy đúng nhánh `feature/*` của người code tính năng đó lắp vào nhánh `master`!
