# TAI - Advanced Static Architecture (HTML/PHP)

🌍 **[English](#english)** | **[日本語](#日本語)** | **[Tiếng Việt](#tiếng-việt)**

---

<h2 id="english">🇬🇧 English</h2>

A battle-tested, high-performance static site generator built on top of Node.js. Designed for cross-platform compatibility (Windows, macOS, Linux), it features a blazing-fast build pipeline parsing **EJS**, **SCSS**, and Vanilla **JS** into a pristine, production-ready `public/` directory within milliseconds.

### ✨ Core Features

- **Dual Build Modes (`new` vs `renew`)**: 
  - `new`: Build modern websites from scratch using EJS components, frontmatter routing, and layout nesting.
  - `renew`: Seamlessly integrate with an existing client's raw codebase. Copies all assets as-is and strictly compiles only the designated SCSS directories. Supports multiple independent SCSS directories concurrently.
- **2-Tier Configuration (`deploy-config.json` & `.env`)**: Securely decouple production CI/CD build instructions into Git from local-only overrides. 
- **Automated CI/CD Deployments**: Fully integrated GitHub Actions workflows for both Manifest-based Differential FTP Deployments (calculating modified files) and automated GitHub clean ZIP Releases.
- **Smart Symlinking**: Effortlessly link your `public/` directory directly into Laragon/XAMPP utilizing `npm run link`.
- **AST-Aware Auto Formatting**: State-of-the-art 2-Phase formatting. Uses `js-beautify` to strictly align HTML and `Prettier` to format internal PHP logic.
- **Next-Gen Image Optimization**: Auto-converts `.jpg` and `.png` to optimized `.webp` formats via Sharp.

### 🚀 Quick Start

1. **Install Dependencies**: `npm install`
2. **Setup Local Env**: Rename `.env.example` to `.env` to configure your local setup (like `WEB_ROOT` and local `SERVER_TYPE`).
3. **Configure Project**: Use `deploy-config.json` to define the project's permanent `MODE` (`new` or `renew`) so the CI/CD pipeline knows how to build it.

#### 🛠️ Available Commands
```bash
npm run dev    # Start the development server with BrowserSync live-reloading
npm run build  # Run a full production build
npm run clean  # Clean the public/ output directory
npm run link   # Setup an OS-level symlink from public/ to your Local Web Server
```

### 📂 Architecture & Build Modes

#### Mode 1: `MODE=new` (New Projects)
Builds everything from the ground up using EJS.
- Create pages directly inside `src/pages/`.
- Use YAML Frontmatter to declare layouts and assets dynamically.
- `OUTPUT_EXT` (in `.env` or `deploy-config.json`) dictates whether pages generate as `.html` or `.php`.
- Components in `src/components/` (starting with `_`) auto-compile into `/components` for deep `<?php include ?>` routing.

#### Mode 2: `MODE=renew` (Client Renewal Projects)
Bypasses the EJS engine. It mirrors the exact structure inside of `src/` directly over to `public/`.
- `RENEW_SCSS_DIR` and `RENEW_CSS_DIR` dictate where the SCSS compiler listens.
- **Multi-Directory Parsing**: You can comma-separate targets! `RENEW_SCSS_DIR=PC/scss, SP/scss` will accurately compile and output independent stylesheets simultaneously.

### 🛠️ Continuous Integration (CI/CD)
This template includes robust server interactions:
1. **Push to Staging (`deploy.yml`)**: Pushing code triggers a strict deployment. It generates a Manifest, hashes the files, and uses a self-destructing PHP Extractor to safely extract ZIPs. If unchanged, it skips the upload completely. It dynamically cleans empty directories.
2. **Create GitHub Release (`release.yml`)**: Pushing a tag (e.g. `v1.0.0`) automatically compiles a clean ZIP file (excluding `.DS_Store` and map files) containing the `public/` directory for pure client delivery.

<br><br>

---

<h2 id="日本語">🇯🇵 日本語</h2>

Node.js上で構築された高速かつ堅牢な静的サイトジェネレーターです。クロスプラットフォーム対応で設計されており、**EJS**、**SCSS**（Dart Sass）、および**Vanilla JS**をミリ秒単位でビルドし、プロダクションレディな`public/`ディレクトリを出力します。

### ✨ 主な機能

- **デュアルビルドモード (`new` と `renew`)**: 
  - `new`: EJSコンポーネント、Frontmatter、およびレイアウトネスティングを使用してゼロからモダンなWebサイトを構築します。
  - `renew`: クライアントの既存ソースコードとシームレスに統合します。全アセットをそのままコピーし、指定されたSCSSディレクトリのみをコンパイルします。複数のSCSSディレクトリの同時コンパイルにも対応しています。
- **2層構成 (`deploy-config.json` と `.env`)**: 本番CI/CD用の設定をGit上で安全に管理し、ローカル環境の固有設定を分離します。
- **自動CI/CDデプロイ**: 変更ファイルのみを計算してアップロードするFTP差分デプロイマニフェスト、およびGitHubクリーンZIPリリースの自動作成ワークフローを完全統合しています。
- **スマート・シンボリックリンク**: `npm run link`コマンド一つで、`public/`ディレクトリをLaragon/XAMPPなどのローカルサーバー環境に直接リンクさせます。
- **画像・フォーマット自動最適化**: Sharpを利用したWebP自動変換に加え、AST対応の`js-beautify`と`Prettier`による2段階フォーマットを提供します。

### 🚀 クイックスタート

1. **依存関係のインストール**: `npm install`
2. **ローカル環境の設定**: `.env.example`を`.env`にリネームし、`WEB_ROOT`や`SERVER_TYPE`などのローカル環境情報を設定します。
3. **プロジェクト設定**: `deploy-config.json`を使用してプロジェクトの永続的なモードを定義し、CI/CDパイプラインに正しいビルド情報を提供します。

#### 🛠️ コマンド一覧
```bash
npm run dev    # BrowserSyncライブリロード付きの開発サーバーを起動
npm run build  # 本番クリーンビルドの実行
npm run clean  # public/ フォルダの自動クリーンアップ
npm run link   # OSレベルで public/ フォルダをWebサーバーのルートへシンボリックリンク化
```

### 📂 アーキテクチャとビルドモード

#### Mode 1: `MODE=new`（新規構築プロジェクト）
- ページは`src/pages/`内に配置し、YAML Frontmatterで動的にレイアウトを管理します。
- `OUTPUT_EXT`の設定により、出力ファイルの拡張子（`.html` または `.php`）を自在に変更可能。
- `src/components/`内のファイルは、`<?php include ?>`用に自動的に抽出・整理されます。

#### Mode 2: `MODE=renew`（既存ソース改修・顧客プロジェクト）
EJSエンジンをスキップし、`src/`内の全ディレクトリ構造を忠実に`public/`へミラーリングします。
- `RENEW_SCSS_DIR` と `RENEW_CSS_DIR` を基準にSCSSコンパイラが稼働します。
- **マルチディレクトリコンパイル**: `RENEW_SCSS_DIR=PC/scss, SP/scss` のようにカンマ区切りで複数のディレクトリを指定すれば、各々の環境を独立して自動コンパイル・監視します。

### 🛠️ 継続的インテグレーション（CI/CD）
- **ステージング自動デプロイ (`deploy.yml`)**: コードをPushすると、マニフェスト（ファイルハッシュ）を用いて差分のみをFTP経由で自動デプロイします。不要になった一時フォルダや削除されたファイルもサーバー上から自動クリーニングされます。
- **ZIPリリースの自動化 (`release.yml`)**: `v1.0.0` のようなタグ付けを行ってPushすると、顧客納品用に不要ファイルを除外したクリーンなZIP出力がGitHub Releases上に自動生成されます。

<br><br>

---

<h2 id="tiếng-việt">🇻🇳 Tiếng Việt</h2>

Hệ thống Website Tĩnh siêu tốc được xây dựng trên Node.js. Thiết kế tối ưu trên mọi nền tảng (Windows, macOS, Linux). Nó cung cấp một luồng Build chớp nhoáng, chuyển hóa **EJS**, **SCSS**, và **JS** thành các file hoàn hảo sẵn sàng trên thư mục `public/` chỉ trong vài mili-giây.

### ✨ Tính Năng Cốt Lõi

- **Chế Độ Build Kép (`new` và `renew`)**: 
  - `new`: Xây dựng site mới tinh từ con số 0 sử dụng EJS component và cấu trúc YAML Frontmatter.
  - `renew`: Kế thừa và tương thích nhanh chóng với source HTML/PHP có sẵn do khách hàng gửi dở dang. Copy y nguyên mọi file nhưng vẫn hỗ trợ compile SCSS cho nhiều thư mục biệt lập (như PC/SP) cùng lúc.
- **Cấu Hình 2 Lớp (`deploy-config.json` & `.env`)**: Tách biệt an toàn giữa file thiết lập vĩnh viễn cho máy chủ CI/CD trên Github và file thiết lập dùng riêng cho máy tính local của cá nhân Developer.
- **Tự Động Hóa CI/CD Toàn Diện**: Tích hợp luồng GitHub Actions "siêu vòng lặp". Tự động soi chi tiết từng file bị sửa đổi / xóa đi để Deploy ngầm lên Máy chủ Staging bằng Manifest Hash. Đồng thời tự động quét và dọn dẹp thư mục rác rỗng.
- **Công Cụ Symlink 1 Chạm**: Chạy `npm run link` để lập tức kết nối mã nguồn từ `public/` sang kho lưu trữ nội bộ của XAMPP/Laragon mà không cần copy thủ công.
- **Tối Ưu Ảnh & Format Code Mức AST**: Tự động convert JPG/PNG thành `.webp`. Đồng thời sử dụng 2 lớp thuật toán Format toán học (giữa `js-beautify` và `Prettier`) để dàn dựng code EJS thành HTML/PHP chuẩn lùi dòng không một tì vết.

### 🚀 Hướng Dẫn Nhanh

1. **Cài Đặt Thư Viện**: `npm install`
2. **Cài Môi Trường Cục Bộ**: Copy `.env.example` thành `.env` để cấu hình đường dẫn `WEB_ROOT` hoặc loại `SERVER_TYPE` (MAMP/Laragon...) tại máy của bạn.
3. **Cấu Hình Dự Án Thực**: Mở `deploy-config.json` để chỉ định cấu hình vĩnh viễn (VD: `MODE="renew"`) để Workflow trên Github hiểu và làm theo.

#### 🛠️ Hệ Thống Lệnh
```bash
npm run dev    # Chạy Watcher mượt mà, bật Local Server kèm BrowserSync Auto-Reload
npm run build  # Xóa sạch và Build mới 100% để sẵn sàng Release
npm run clean  # Clean dọn dẹp thư mục public/
npm run link   # Lệnh HĐH tạo Symlink folder public/ sang Ổ đĩa ảo Local Server
```

### 📂 Kiến Trúc & Chế Độ Build

#### Chế Độ 1: `MODE=new` (Dự án xây mới chuẩn)
Build mọi thứ từ EJS engine.
- Tạo files trong `src/pages/` kết hợp YAML Frontmatter để nhúng Layouts.
- Setup `OUTPUT_EXT=php` hay `html` là trang sẽ được xuất ra y format đó.
- Nén tất tần tật file trong `src/components/` thành từng trạm Component độc lập để điều khiển bằng `<?php include ?>` toàn diện sâu mọi ngóc ngách.

#### Chế Độ 2: `MODE=renew` (Dự án chỉnh sửa khách hàng)
Bỏ qua EJS Engine. Trực tiếp nhân bản tỷ lệ 1:1 từ `src/` qua thẳng `public/`.
- Quản lý gốc tọa độ SCSS bằng thuộc tính `RENEW_SCSS_DIR` và `RENEW_CSS_DIR`.
- **Hỗ Trợ Quét Đa Thư Mục**: Hỗ trợ quét song song theo danh sách! Khai báo dạng `RENEW_SCSS_DIR=PC/scss, SP/scss` để biên dịch cùng lúc nhiều nhánh dự án khách hàng.

### 🛠️ Tích Hợp Hệ Thống Liên Tục (CI/CD)
- **Đẩy Lên Server Tự Động (`deploy.yml`)**: Cứ Push Code là Git tự chạy. Thuật toán tạo và dò file Manifest cho phép nó phân loại chính xác hàng ngàn file thành các tệp: Mới Tạo, Chỉnh Sửa, và Xóa Số đi. Kết hợp cùng trình Extract ZIP nội bộ cực nhanh tự hủy, Deploy lên Server giờ chỉ tốn vài chục giây. Chế độ thu hồi rác ảo, dọn thư mục rỗng hoàn toàn tự động!
- **Tạo Release Khách Hàng (`release.yml`)**: Gắn tag bản quyền (ví dụ `v1.0.0`) rồi Push - Ngay lập tức một file nén ZIP không chứa file metadata rác (`.deploy/`, `.DS_Store`) sẽ sinh ra trong Tab Release trên GitHub, trong sạch chờ tải xuống bàn giao!

<br><br>

---

*Built with ❤️ for High-Performance Architectures.*
