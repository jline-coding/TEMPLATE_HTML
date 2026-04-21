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

## 2. `deploy-config.json` の設定
プロジェクトを開始する前に、ルートディレクトリにある `deploy-config.json` で全体のビルド方式や展開先を定義します。

```json
{
  "source_folder": "----public-----",
  "project_dir": "----name_project-----",
  "build_command": "npm run build",
  "env": {
    "MODE": "----(new)----(renew)----",
    "OUTPUT_EXT": "----(html)----(php)----",
    "USE_PHP_INCLUDE": "----(false)----(true)----",
    "RENEW_SCSS_DIR": "----path/to/scss-----",
    "RENEW_CSS_DIR": "----path/to/css-----",
    "SITE_URL": "----https://your-domain.com-----"
  },
  "production": {
    "deploy_method": "----(zip)----(ftp)----(ssh)----",
    "server": "----YOUR_SERVER_NAME_CONFIG-----",
    "basic_auth": {
      "username": "----username-----",
      "password": "----password-----"
    }
  },
  "test": {
    "deploy_method": "----(zip)----(ftp)----(ssh)----",
    "server": "----YOUR_SERVER_NAME_CONFIG-----",
    "basic_auth": {
      "username": "----username-----",
      "password": "----password-----"
    }
  }
}
```

### パラメータ詳細・設定リスト

| パラメータ名 | 状態 | 意味と使い方の説明 |
| :--- | :---: | :--- |
| **`source_folder`** | 基本 | ビルドされた出力先のフォルダ名（通常は `public`）。 |
| **`project_dir`** | 必須 | サーバー展開先の親ディレクトリ名。 |
| **`build_command`** | 基本 | GitHub Actions 用のビルド実行コマンド（`npm run build`）。 |
| **`env.MODE`** | 必須 | `new` (新規HTML/PHP構築) または `renew` (既存サイト改修)。 |
| **`env.OUTPUT_EXT`** | 必須 | EJSコンパイル後の出力拡張子（`html` または `php`）。 |
| **`env.USE_PHP_INCLUDE`**| 任意 | `true` でHeader/FooterをPHPの `include` 化。 `false` でHTMLインジェクト。 |
| **`env.RENEW_SCSS_DIR`** | 任意 | `renew` モード専用。既存ソースの対象作業SCSSディレクトリパス。 |
| **`env.RENEW_CSS_DIR`**  | 任意 | `renew` モード専用。既存ソースの出力先CSSディレクトリパス。 |
| **`env.SITE_URL`** | 任意 | プロジェクトの基本ルートURL（例: `https://your-domain.com`）。`<meta>` タグ等のOGP生成に使用。 |
| **`[branch].deploy_method`**| 必須 | 環境別のデプロイ方式。`"ftp"`, `"ssh"`, `"zip"` が選択可能。 |
| **`[branch].server`**| 任意 | GitHub Secrets に保管された接続設定の名前。`"zip"` の場合は空欄可。 |
| **`[branch].basic_auth`**| 任意 | `"ftp"`/`"ssh"` デプロイ時に指定すると、自動的にベーシック認証の設定を施します。 |

## 3. ワークフロー（各ケースの実行手順）

### ケース 1: 静的HTMLサイトの構築 (`new html`)
EJSコンポーネントから一般的な静的HTMLをビルドします。
1. **設定**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"new"`
     - `"OUTPUT_EXT"`: `"html"`
     - `"USE_PHP_INCLUDE"`: `"false"`
     - `"SITE_URL"`: `"https://your-domain.com"`
   - **`.env`**: **不要です。** `WEB_ROOT` と `PROXY_URL` は空白のままで問題ありません。
2. **コーディング**: `src/` フォルダ内で作業を行います。
- **🚀 実行フロー**:
  ```bash
  npm run dev        # 開発開始
  npm run build      # 完成時に実行
  ```

---

### ケース 2: 一体型PHPサイトのコーディング (`new php`)
目的: EJSを `.php` 拡張子に変換し（内部でPHP関数を使用するため）、レイアウトのヘッダー/フッターをベタ打ちのHTMLとして1つのファイルに直接流し込みます。
1. **設定**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"new"`
     - `"OUTPUT_EXT"`: `"php"`
     - `"USE_PHP_INCLUDE"`: `"false"`
     - `"SITE_URL"`: `"https://your-domain.com"`
   - **`.env`**: **必須記載。** PHPプロキシパイプラインをスムーズに作成するために、`WEB_ROOT` と `PROXY_URL` を正確に入力する必要があります。
2. **コード記述**: `src/` フォルダ内の純正ソースを直接編集します。ここにPHPコードを自由に挿入できます。
- **🚀 クイック起動コマンド**: 仮想サーバーを起動してから、以下を実行します:
  ```bash
  npm run link       # 初回のみ（※仮想サーバーが存在しないか削除された場合は再実行）
  npm run dev        # 開発開始 (Dev起動)
  npm run build      # プロジェクト確定時
  ```

---

### ケース 3: 分割組み立て型PHPコーディング (`new php INCLUDE`)
目的: ヘッダー/フッターを切り外して自動的に `public/components` 内の独立したファイルとし、`<?php include ?>` コードを通じて連続的にインクルードさせます。
1. **設定**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"new"`
     - `"OUTPUT_EXT"`: `"php"`
     - `"USE_PHP_INCLUDE"`: `"true"`
     - `"SITE_URL"`: `"https://your-domain.com"`
   - **`.env`**: **必須記載。** 上のケースと同様に、プロキシがルートを把握できるように `WEB_ROOT` と `PROXY_URL` を正確に入力してください。
2. **コード記述**: インターフェースのコーディングと管理は `src/` フォルダ内で行います。
- **🚀 クイック起動コマンド**: 仮想サーバーを起動してから、以下を実行します:
  ```bash
  npm run link       # 初回のみ（※仮想サーバーが存在しないか削除された場合は再実行）
  npm run dev        # 開発開始 (Dev起動)
  npm run build      # プロジェクト確定時
  ```

---

### ケース 4: クライアントソースの改修 (静的HTML) (`renew html`)
目的: クライアントが純粋な `.html` のソースセットを提供し、あなたはこのプロジェクト用にSCSSを記述するだけの場合。この規模なら仮想プロキシを有効にする必要はありません。
1. **設定**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"renew"`
     - `"OUTPUT_EXT"`: `"html"`
     - `"USE_PHP_INCLUDE"`: `""`
     - `"SITE_URL"`: `""`
   - **`.env`**: **サーバーの記入は不要です。** SCSSのコンパイル対象を追加宣言するだけです（PCとSPを独立してコーディングするための複数ターゲットのカンマ区切りをサポート）:
     ```env
     # 記述例（1つまたは複数のブランチフォルダをサポート）:
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **コード記述**: `src/` フォルダ内の現在あるものを **完全にすべて** 削除し、クライアントのソースコードをそのまま `src/` フォルダに直接アップロードします。
3. **SCSSの統合**: `src/` に投げ込んだクライアントソースブロック内の任意の場所に自由にSCSSフォルダを新規作成します。ただ、`.env` 内の `RENEW_SCSS_DIR` と出力先の `RENEW_CSS_DIR` パス宣言がその位置と正確に一致することだけを確認してください。
- **🚀 クイック起動コマンド**:
  ```bash
  npm run dev        # 開発開始 (Dev起動)
  npm run build      # プロジェクト確定時
  ```

---

### ケース 5: クライアントソースの改修 (動的PHP) (`renew php`)
目的: クライアントが `.php` 拡張子を含むソース（WordPress CMSなど）を提供した場合。ターミナルのWatch CSSがBrowserSync上で直接PHPコードを表示できるように、必ず仮想サーバーへのプロキシパイプを接続する必要があります。
1. **設定**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"renew"`
     - `"OUTPUT_EXT"`: `"php"`
     - `"USE_PHP_INCLUDE"`: `""`
     - `"SITE_URL"`: `""`
   - **`.env`**: **必須記載。** 上記のケースと同様に正確な `WEB_ROOT` と `PROXY_URL` を宣言します。さらにSCSSのコンパイル対象を宣言します:
     ```env
     # 記述例（1つまたは複数のブランチフォルダをサポート）:
     RENEW_SCSS_DIR=PC/scss, SP/scss
     RENEW_CSS_DIR=PC/css, SP/css
     ```
2. **コード記述**: `src/` フォルダ内の現在あるものを **完全にすべて** 削除し、クライアントのソースコードをそのまま `src/` フォルダに直接アップロードします。
3. **SCSSの統合**: `src/` に投げ込んだクライアントソースブロック内の任意の場所に自由にSCSSフォルダを新規作成します。ただ、`.env` 内の `RENEW_SCSS_DIR` と出力先の `RENEW_CSS_DIR` パス宣言がその位置と正確に一致することだけを確認してください。
- **🚀 クイック起動コマンド**: 仮想サーバーを起動してから、以下を実行します:
  ```bash
  npm run link       # 初回のみ（※仮想サーバーが存在しないか削除された場合は再実行）
  npm run dev        # 開発開始 (Dev起動)
  npm run build      # プロジェクト確定時
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

## 2. Thiết Lập `deploy-config.json`
Trước khi bắt đầu dự án, bạn cần cấu hình thư mục xuất, chế độ build và phương thức deploy trong file `deploy-config.json`:

```json
{
  "source_folder": "public",
  "project_dir": "----name_project-----",
  "build_command": "npm run build",
  "env": {
    "MODE": "----(new)----(renew)----",
    "OUTPUT_EXT": "----(html)----(php)----",
    "USE_PHP_INCLUDE": "----(false)----(true)----",
    "RENEW_SCSS_DIR": "----path/to/scss-----",
    "RENEW_CSS_DIR": "----path/to/css-----",
    "SITE_URL": "----https://your-domain.com-----"
  },
  "production": {
    "deploy_method": "----(zip)----(ftp)----(ssh)----",
    "server": "----YOUR_SERVER_NAME_CONFIG-----",
    "basic_auth": {
      "username": "----username-----",
      "password": "----password-----"
    }
  },
  "test": {
    "deploy_method": "----(zip)----(ftp)----(ssh)----",
    "server": "----YOUR_SERVER_NAME_CONFIG-----",
    "basic_auth": {
      "username": "----username-----",
      "password": "----password-----"
    }
  }
}
```

### Bảng Giải Thích Tham Số Cấu Hình

| Thuộc tính (Trường) | Trạng thái | Ý nghĩa & Hướng dẫn thiết lập |
| :--- | :---: | :--- |
| **`source_folder`** | Mặc định | Tên thư mục chứa source đã build (thường là `public`, hệ thống sẽ dựa vào đây để đẩy code). |
| **`project_dir`** | Bắt buộc | Tên thư mục của dự án (Tự động sinh ra thư mục rễ tương ứng trên Server của khách). |
| **`build_command`** | Mặc định | Lệnh chạy Build trong luồng tự động GitHub Actions (thường để nguyên là `npm run build`). |
| **`env.MODE`** | Bắt buộc | Dùng `new` (Dành cho web dựng lại từ đầu) hoặc `renew` (Dành cho làm Layout/SCSS trên web cũ). |
| **`env.OUTPUT_EXT`** | Bắt buộc | Định dạng đuôi file xuất ra sau khi biên dịch EJS (`html` hoặc `php`). |
| **`env.USE_PHP_INCLUDE`**| Tùy chọn | Set `true` để chia nhỏ Header/Footer thành module PHP, set `false` để ráp khối HTML trực tiếp. |
| **`env.RENEW_SCSS_DIR`** | Tùy chọn | Dùng cho mode `renew`: Trỏ đường dẫn phân cấp tới thư mục chứa file SCSS nguồn xịn. |
| **`env.RENEW_CSS_DIR`** | Tùy chọn | Dùng cho mode `renew`: Trỏ đường dẫn xuất đích CSS để đè file gốc của khách hàng. |
| **`env.SITE_URL`** | Tùy chọn | Link domain gốc của website (VD: `https://your-domain.com`), để hệ thống sinh thẻ `<meta>` OGP/Canonical. |
| **`[nhánh].deploy_method`**| Bắt buộc | Phương thức đẩy code cho từng nhánh: `"ftp"`, `"ssh"`, hoặc `"zip"`. |
| **`[nhánh].server`** | Tùy chọn | Khóa truy xuất lưu trữ trong phân luồng GitHub Secrets. Bỏ trống nếu áp dụng dạng nén mộc `"zip"`. |
| **`[nhánh].basic_auth`**| Tùy chọn | Gắn xác thực cơ bản cho site trên Server lúc Test. Có thể thiết lập hoặc không (nếu không cần thiết, hãy xóa khối `basic_auth` này khỏi `deploy-config.json`). |

## 3. Hướng Dẫn Thực Hành Các Trường Hợp

### Trường hợp 1: Code Trang HTML Thuần (`new html`)
Mục đích: Viết code EJS chia nhỏ ra nhưng khi xuất thì rập khuôn thành 1 file `.html` cứng tĩnh.
1. **Cấu hình**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"new"`
     - `"OUTPUT_EXT"`: `"html"`
     - `"USE_PHP_INCLUDE"`: `"false"`
     - `"SITE_URL"`: `"https://your-domain.com"`
   - **`.env`**: **Ngó lơ/Không cần điền.** Bạn không cần quan tâm đến `WEB_ROOT` hay `PROXY_URL` ở trường hợp này.
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
   - **`deploy-config.json`**:
     - `"MODE"`: `"new"`
     - `"OUTPUT_EXT"`: `"php"`
     - `"USE_PHP_INCLUDE"`: `"false"`
     - `"SITE_URL"`: `"https://your-domain.com"`
   - **`.env`**: **BẮT BUỘC ĐIỀN.** Phải điền chính xác `WEB_ROOT` và `PROXY_URL` để tạo ống dẫn Proxy PHP mượt mà.
2. **Code**: Trực tiếp sửa đổi source gốc bên trong thư mục `src/`. Bạn có thể chèn code PHP loạn xạ ở đây.
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo, sau đó:
  ```bash
  npm run link       # Chỉ chạy 1 lần (Lưu ý: phải chạy lại nếu server ảo chưa có hoặc bị xóa)
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

---

### Trường hợp 3: Code PHP Lắp Ráp Cắt Lớp (`new php INCLUDE`)
Cắt phăng Header/Footer ra thành các file tách rời tự động trong `public/components` và nhúng nối tiếp thông qua mã `<?php include ?>`.
1. **Cấu hình**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"new"`
     - `"OUTPUT_EXT"`: `"php"`
     - `"USE_PHP_INCLUDE"`: `"true"`
     - `"SITE_URL"`: `"https://your-domain.com"`
   - **`.env`**: **BẮT BUỘC ĐIỀN.** Giống mục trên, phải điền chính xác `WEB_ROOT` và `PROXY_URL` để Proxy hiểu đường truyền.
2. **Code**: Thực hiện code và quản lý giao diện bên trong thư mục `src/`.
- **🚀 Lệnh Khởi Chạy Nhanh**: Bật Server ảo, sau đó:
  ```bash
  npm run link       # Chỉ chạy 1 lần (Lưu ý: phải chạy lại nếu server ảo chưa có hoặc bị xóa)
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

---

### Trường hợp 4: Nối Source Khách Hàng (Tĩnh HTML) (`renew html`)
Mục đích: Khách giao một bộ Source thuần đuôi `.html`. Bạn chỉ việc viết SCSS cho dự án. Cỡ này không cần bật ảo hóa Proxy.
1. **Cấu hình**: 
   - **`deploy-config.json`**:
     - `"MODE"`: `"renew"`
     - `"OUTPUT_EXT"`: `"html"`
     - `"USE_PHP_INCLUDE"`: `""`
     - `"SITE_URL"`: `""`
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
   - **`deploy-config.json`**:
     - `"MODE"`: `"renew"`
     - `"OUTPUT_EXT"`: `"php"`
     - `"USE_PHP_INCLUDE"`: `""`
     - `"SITE_URL"`: `""`
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
  npm run link       # Chỉ chạy 1 lần (Lưu ý: phải chạy lại nếu server ảo chưa có hoặc bị xóa)
  npm run dev        # Chạy dev
  npm run build      # Khi chốt dự án
  ```

