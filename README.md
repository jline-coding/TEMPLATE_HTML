# 日本語

# 📦 Template JLine HTML
EJS、SCSS、JavaScriptを使用した静的サイト用テンプレート。最新のビルドシステムとFTPサーバーへの自動CI/CDデプロイ機能を搭載しています。

## 💻 システム要件
- Node.js (v20 以上): 各環境での推奨インストール方法
  - **Windows**: [nvm-windows](https://github.com/coreybutler/nvm-windows) などのバージョン管理ツール、または公式インストーラー
  - **Mac / Linux**: [nvm](https://github.com/nvm-sh/nvm) または [fnm](https://github.com/Schniz/fnm) の使用を推奨します。
- npm (v9 以上)
- Git (v2 以上)

## 🚀 インストールと実行 (Windows, Mac, Linux 共通)
### 1. プロジェクトのクローン
ターミナル (Mac/Linux) または コマンドプロンプト / PowerShell (Windows) を開き、以下のコマンドを実行します：
```bash
git clone https://github.com/jline-coding/TEMPLATE_HTML
cd TEMPLATE_HTML
```

### 2. 依存関係のインストール
```bash
npm install
```
*(Mac / Linux でパーミッションエラーが出た場合は、`sudo` を使わずに `nvm` を利用して Node.js 環境を構築することを推奨します。)*

### 3. 開発サーバーの起動 (ローカル開発)
```bash
npm run dev
```
- `src/` フォルダ内の変更を監視し、自動でビルドを行います。
- ブラウザが自動的に開き `http://localhost:8080` を表示します。ファイル保存時に変更が即座に反映 (ホットリロード) されます。

### 4. 本番用ビルド
```bash
npm run build
```
- 最適化されたファイルが自動生成され、`public/` フォルダに出力されます。

### 5. クリーンアップ
```bash
npm run clean
```
- 生成済みの `public/` フォルダのデータをすべて削除します。

---

## ✨ テンプレートの主要機能 (詳細解説)

1. **EJS と Front Matter によるモジュール化されたHTML生成**
   - 共通のレイアウト設定 (`_default.ejs` 等) や、ヘッダー・フッターのコンポーネント管理が可能です。
   - 各ファイルの先頭に記述される Front Matter (gray-matter を採用) によって、`title`、`description` などのSEOメタデータや、読み込む CSS/JS のリストをページ毎に個別に制御できます。

2. **高速な SCSS コンパイルと CSS 高度最適化**
   - ネイティブ言語で実装された超高速の `sass-embedded` で SCSS を解析します。
   - `postcss` と `autoprefixer` を用いてブラウザごとのベンダープレフィックスを自動付与。さらに `cssnano` と `postcss-sort-media-queries` を連携させ、CSSコードの極限までの軽量化（Minify化）を実現します。

3. **リアルタイムな開発環境 (Browser-Sync + Chokidar)**
   - ソースコード全体を監視し、変更された差分のみを再ビルド。即座にブラウザのリロードを実行し、シームレスなコーディング体験を提供します。

4. **画像の自動最適化 (`sharp` エンジン)**
   - 開発で配置した画像を、自動的に軽量かつ次世代フォーマットである `.webp` に変換し、Webページの読み込み速度を飛躍的に向上させます。

5. **自動化された CI/CD (FTPデプロイ)**
   - GitHub Actions を用いた FTP デプロイが最初から組み込まれています。
   - ルート階層の `deploy-config.json` にてサーバーと対象ディレクトリを設定するだけで、`main` ブランチへのプッシュ時に自動的にデプロイが行われます。
   - デプロイ時の設定に Basic 認証の情報を含めることができ、プレビュー環境や本番環境への不正アクセスを自動的に防ぐシステムを完備しています。

---
---

# Tiếng Việt

# 📦 Template JLine HTML
Template dự án web tĩnh được trang bị hệ thống build cực kỳ hiện đại bằng EJS, SCSS, JavaScript, kết hợp CI/CD tự động deploy lên FTP server.

## 💻 Yêu cầu hệ thống
- Node.js (v20+): Khuyến nghị cài đặt thông qua trình quản lý phiên bản:
  - **Windows**: Sử dụng [nvm-windows](https://github.com/coreybutler/nvm-windows) hoặc tải bộ cài chuẩn trực tiếp.
  - **Mac / Linux**: Sử dụng [nvm](https://github.com/nvm-sh/nvm) hoặc [fnm](https://github.com/Schniz/fnm).
- npm (v9+): Cài đặt sẵn cùng Node.js.
- Git (v2+)

## 🚀 Cài đặt & Chạy dự án (Hoạt động đa nền tảng: Windows, Mac, Linux)
### 1. Clone dự án
Mở Terminal (trên Mac / Linux) hoặc Command Prompt / PowerShell (trên Windows), và gõ lệnh:
```bash
git clone https://github.com/jline-coding/TEMPLATE_HTML
cd TEMPLATE_HTML
```

### 2. Cài đặt các Package phụ thuộc
```bash
npm install
```
*(Nếu trên hệ điều hành Mac/Linux bạn gặp lỗi phân quyền permission denied, không nên sử dụng `sudo` mà hãy đảm bảo cài đặt môi trường Node.js thông qua nvm).*

### 3. Chạy môi trường phát triển (Local Development)
```bash
npm run dev
```
- Các tệp tin trong thư mục `src/` sẽ được theo dõi. Mọi thao tác lưu tệp đều sẽ kích hoạt build lại ngay lập tức.
- Trình duyệt tự mở ở địa chỉ `http://localhost:8080` với cơ chế (Hot-reload), màn hình sẽ được cập nhật tự động.

### 4. Build sản phẩm (Production)
```bash
npm run build
```
- Trình biên dịch sẽ thu gọn, nén, và tối ưu hóa mã nguồn rồi xuất ra thư mục tĩnh mang định dạng hoàn chỉnh tại `public/`.

### 5. Xóa thư mục build
```bash
npm run clean
```
- Quét sạch toàn bộ thay đổi và xóa thư mục output đầu ra `public/`.

---

## ✨ Các tính năng chi tiết của Template

1. **Kiến trúc HTML linh hoạt qua EJS & Front Matter**
   - Sử dụng View Engine EJS để chia sẻ cấu trúc (Headers, Footers, Default Layouts), tái sử dụng mã hiệu quả.
   - Tính năng Front Matter (plugin gray-matter) cho phép bạn đặt các cấu hình tại dòng đầu tiên của file `.ejs`. Cực kỳ hữu dụng khi bạn muốn tuỳ chỉnh `title`, `description`, cùng việc gọi đường dẫn CSS/JS đặc thù chỉ riêng cho trang web đó.

2. **Dịch SCSS & Hệ thống Tối ưu CSS Đỉnh cao**
   - Biên dịch tốc độ cao với bộ xử lý lõi Native `sass-embedded`.
   - Kết hợp `postcss` và `autoprefixer` để tự động xử lý tiền tố tương thích cho các trình duyệt (vendor-prefixes). Hơn nữa, tích hợp cùng `cssnano` và `postcss-sort-media-queries` để tối thiểu hoá kích thước file mã CSS đến giọt cuối cùng.

3. **Môi trường Web thực thời gian (Browser-Sync + Chokidar)**
   - Theo dõi từng thay đổi nhỏ thông qua `chokidar`, ngay lập tức compile và bơm mã mới lên trình duyệt bằng Browser-Sync, tạo ra luồng dev vô cùng nhanh và không độ trễ.

4. **Công cụ tự động chuyển đổi ảnh (`sharp`)**
   - Toàn bộ ảnh sẽ được engine `sharp` nén lại và chuyển định dạng qua chuẩn hình ảnh thân thiện dùng riêng cho Web là `.webp`, giúp tăng chỉ số tải trang đáng kể.

5. **Giải pháp tự động triển khai - CI/CD FTP Deploy tự động**
   - Template đi kèm luồng GitHub Actions để phân phối dự án trực tiếp lên máy chủ FTP.
   - Bạn chỉ cần thông qua tệp tin `deploy-config.json` lưu tại thư mục gốc để tuỳ biến thông tin. Mỗi lệnh push lên nhánh `main` được quy định đều tự động khởi chạy chu trình đưa code lên server.
   - Đặc biệt, pipeline CI/CD còn có tính năng kích hoạt cấu hình Basic Authorization để bảo vệ site và kiểm soát truy cập từ những giai đoạn kiểm thử.

---
---

# English

# 📦 Template JLine HTML
A highly optimized static website template powered by EJS, SCSS, and JavaScript, featuring an ultra-modern build structure and streamlined CI/CD FTP deployment workflows.

## 💻 System Requirements
- Node.js (v20+): Recommended installation process via version managers:
  - **Windows**: Use [nvm-windows](https://github.com/coreybutler/nvm-windows) or the official system installer.
  - **Mac / Linux**: Utilize [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm).
- npm (v9+): Packaged alongside Node.js naturally.
- Git (v2+)

## 🚀 Installation & Usage (Cross-Platform compatibility: Windows, Mac, Linux)
### 1. Clone the repository
Inaugurate your Terminal (Mac/Linux) or Command Prompt / PowerShell bounds (Windows), and type:
```bash
git clone https://github.com/jline-coding/TEMPLATE_HTML
cd TEMPLATE_HTML
```

### 2. Install Dependencies
```bash
npm install
```
*(For Mac/Linux environments encountering permission exceptions, avoid resorting to `sudo` permissions; rather ensure proper Node environments configured by nvm).*

### 3. Run the Development Server (Local Development)
```bash
npm run dev
```
- Intelligently observes the `src/` directory mappings. As soon as a file is updated and saved, differential rebuilding processes occur.
- Automatically initiates the project in your browser on `http://localhost:8080`, applying instantaneous reloading updates (Hot-reload methodology).

### 4. Build for Production
```bash
npm run build
```
- Fully resolves minifications, asset generations, and optimizations to finalize production ready assets safely nested inside the `public/` directory.

### 5. Clean output
```bash
npm run clean
```
- Eliminates the previously built and active `public/` folder entirely.

---

## ✨ Detailed Breakdown of Core Features

1. **Modular HTML Processing powered by EJS & Front Matter**
   - Provides EJS rendering to govern repetitive template components such as unified Base Layouts, Headers, and Footers systematically.
   - Operates utilizing Front Matter properties via the `gray-matter` module embedded at the head of every individual `.ejs` file. This lets developers explicitly configure page variables dynamically, injecting crucial SEO attributes (`title`, `description`) or even distinct script/styles required strictly per route endpoint context.

2. **Turbocharged SCSS Parsing & Peerless CSS Minification**
   - Propelled under-the-hood by native speed engines explicitly via `sass-embedded`.
   - Naturally integrated dynamically alongside `postcss` and `autoprefixer` engines acting rapidly granting browser vendor-prefixes automatically. Followed comprehensively by `cssnano` and `postcss-sort-media-queries` rendering maximum compression footprints feasible to reduce bandwidth overhead.

3. **Live Syncing Ecosystem Environment (Browser-Sync + Chokidar)**
   - Smart background file-system watcher targeting targeted delta mutations safely compiling segments into RAM logic without performance latency problems, immediately triggering synchronization hooks inside current browser viewports seamlessly.

4. **Next-Generation Image Transformations (`sharp`)**
   - Connects directly onto the powerful backend API engine of `sharp`; compressing graphical heavy images by implicitly re-converting formats swiftly over towards optimized modern web patterns specifically conforming to standard `.webp` file structures implicitly natively out of the box preserving extreme bandwidth data.

5. **Integrated CI/CD GitHub Action FTP Flows**
   - Shipped by default with persistent and secure mechanisms delegating updates across straight remote FTP hosting deployments.
   - Configuration remains inherently elementary; handled primarily adjusting the `deploy-config.json` configuration block at root location. Simply push modifications strictly conforming into the `main` git branch and observe workflows transparently automate the staging phases fully.
   - Extends custom configurable traits protecting staging directories using dynamic basic authentication HTTP protocols defending access layers entirely securely per test-bench builds proactively.
