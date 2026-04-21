# TAI - Web Build System

🌍 **[日本語](#日本語)** | **[Tiếng Việt](#tiếng-việt)**

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
   - `deploy-config.json`: `"MODE": "new"`, `"OUTPUT_EXT": "html"`, `"USE_PHP_INCLUDE": "false"`, `"SITE_URL": "https://your-domain.com"` を指定します。
   - `.env`: **不要です。** `WEB_ROOT` と `PROXY_URL` は空白のままで問題ありません。
2. **コーディング**: `src/` フォルダ内で作業を行います。
- **🚀 実行フロー**:
  ```bash
  npm run dev        # 開発開始
  npm run build      # 完成時に実行
  ```

---

### ケース 2: PHPサイトの構築・単一ファイル (`new php`)
EJSを`.php`としてビルドしますが、ヘッダー等のレイアウトは抽出せず、一つのファイルに直接インジェクトしたままにします。
1. **設定**: 
   - `deploy-config.json`: `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "false"`, `"SITE_URL": "https://your-domain.com"` を指定します。
   - `.env`: **必須です。** PHPプロキシを動作させるため、`WEB_ROOT` と `PROXY_URL` を設定してください。
2. **コーディング**: `src/` フォルダ内で記述します。EJS内にPHP構文を混在できます。
- **🚀 実行フロー**: ローカルサーバーを起動してから:
  ```bash
  npm run link       # 初回のみ
  npm run dev        # 開発開始
  npm run build      # 完成時に実行
  ```

---

### ケース 3: PHPサイトの構築・モジュール分割 (`new php INCLUDE`)
コンポーネントを独立した物理ファイルとして分離出力し、動的に `<?php include ?>` で呼び出します。
1. **設定**:
   - `deploy-config.json`: `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "true"`, `"SITE_URL": "https://your-domain.com"` を指定します。
   - `.env`: **必須です。** PHPプロキシを動作させるため、`WEB_ROOT` と `PROXY_URL` を設定してください。
2. **コーディング**: `src/` フォルダ内で記述します。
- **🚀 実行フロー**: ローカルサーバーを起動してから:
  ```bash
  npm run link       # 初回のみ
  npm run dev        # 開発開始
  npm run build      # 完成時に実行
  ```

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
- **🚀 実行フロー**:
  ```bash
  npm run dev        # 開発開始
  npm run build      # 完成時に実行
  ```

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
- **🚀 実行フロー**: ローカルサーバーを起動してから:
  ```bash
  npm run link       # 初回のみ
  npm run dev        # 開発開始
  npm run build      # 完成時に実行
  ```


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
   - `deploy-config.json`: Hãy set `"MODE": "new"`, `"OUTPUT_EXT": "html"`, `"USE_PHP_INCLUDE": "false"`, `"SITE_URL": "https://your-domain.com"`.
   - `.env`: **Ngó lơ/Không cần điền.** Bạn không cần quan tâm đến `WEB_ROOT` hay `PROXY_URL` ở trường hợp này.
2. **Code**: Thực hiện code và quản lý giao diện bên trong thư mục `src/`.
- **🚀 Lệnh Khởi Chạy Nhanh**:
  ```bash
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

---

### Trường hợp 2: Code Trang PHP Nguyên Tảng (`new php`)
Mục đích: Biến EJS thành đuôi `.php` (để dùng hàm PHP bên trong) nhưng bắt buộc Layout Header/Footer phải đổ trực tiếp HTML thô tháp vào 1 file duy nhất.
1. **Cấu hình**: 
   - `deploy-config.json`: Hãy set `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "false"`, `"SITE_URL": "https://your-domain.com"`.
   - `.env`: **BẮT BUỘC ĐIỀN.** Phải điền chính xác `WEB_ROOT` và `PROXY_URL` để tạo ống dẫn Proxy PHP mượt mà.
2. **Code**: Trực tiếp sửa đổi source gốc bên trong thư mục `src/`. Bạn có thể chèn code PHP loạn xạ ở đây.
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo, sau đó:
  ```bash
  npm run link       # Chỉ chạy 1 lần đầu
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

---

### Trường hợp 3: Code PHP Lắp Ráp Cắt Lớp (`new php INCLUDE`)
Cắt phăng Header/Footer ra thành các file tách rời tự động trong `public/components` và nhúng nối tiếp thông qua mã `<?php include ?>`.
1. **Cấu hình**: 
   - `deploy-config.json`: Hãy set `"MODE": "new"`, `"OUTPUT_EXT": "php"`, `"USE_PHP_INCLUDE": "true"`, `"SITE_URL": "https://your-domain.com"`.
   - `.env`: **BẮT BUỘC ĐIỀN.** Giống mục trên, phải điền chính xác `WEB_ROOT` và `PROXY_URL` để Proxy hiểu đường truyền.
2. **Code**: Thực hiện code và quản lý giao diện bên trong thư mục `src/`.
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo, sau đó:
  ```bash
  npm run link       # Chỉ chạy 1 lần đầu
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

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
- **🚀 Lệnh Khởi Chạy Nhanh**:
  ```bash
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

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
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo, sau đó:
  ```bash
  npm run link       # Chỉ chạy 1 lần đầu
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

