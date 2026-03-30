# 日本語

# 📦 Template JLine HTML

EJS + SCSS + JavaScript を使用した静的サイトテンプレート。自動ビルド・ホットリロード・CI/CD FTPデプロイ機能を搭載。

---

## 💻 システム要件

| ツール   | バージョン |
| -------- | ---------- |
| Node.js  | v20 以上   |
| npm      | v9 以上    |
| Git      | v2 以上    |

**インストール方法:**
- **Windows**: [nvm-windows](https://github.com/coreybutler/nvm-windows) または [公式インストーラー](https://nodejs.org/)
- **Mac**: `brew install node` または [nvm](https://github.com/nvm-sh/nvm)
- **Linux**: [nvm](https://github.com/nvm-sh/nvm) を推奨 (`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`)

---

## 🚀 インストールと実行

### 1. クローン
```bash
git clone https://github.com/jline-coding/TEMPLATE_HTML
cd TEMPLATE_HTML
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 開発サーバーの起動
```bash
npm run dev
```
- `src/` を監視し自動ビルド
- `http://localhost:8080` でブラウザが自動で開く
- ファイル保存時にホットリロード

### 4. 本番ビルド
```bash
npm run build
```
- `public/` にCSSの圧縮化・画像のWebP変換など、最適化済みファイルが出力される

### 5. ビルド出力の削除
```bash
npm run clean
```

---

## 📁 src ディレクトリ構造

```
src/
├── layouts/                       ← 共通レイアウト
│   ├── _default.ejs               ← メインレイアウト (HTML全体の骨組み)
│   ├── _header.ejs                ← ヘッダーコンポーネント
│   └── _footer.ejs                ← フッターコンポーネント
│
├── assets/
│   ├── scss/                      ← スタイルシート (SCSS)
│   │   ├── global/                ← 設計変数・関数・mixin (直接CSSを出力しない)
│   │   │   ├── _breakpoints.scss  ← レスポンシブのブレークポイント定義
│   │   │   ├── _color.scss        ← カラー変数
│   │   │   ├── _font.scss         ← フォント変数
│   │   │   ├── _content-width.scss← コンテンツ幅定義
│   │   │   ├── _function.scss     ← rem(), vw(), clamped() 関数
│   │   │   ├── _mixin.scss        ← 汎用 mixin
│   │   │   └── _extend.scss       ← レスポンシブ font-size プレースホルダー (%fz-10 ～ %fz-56)
│   │   ├── foundation/            ← リセットCSS・ベーススタイル
│   │   ├── layout/                ← レイアウト部品 (container)
│   │   ├── component/             ← 共通UIパーツ (header, footer, btn, texts, titles 等)
│   │   ├── page/                  ← ページ固有スタイル (common/, top/ 等)
│   │   ├── utilities/             ← ユーティリティクラス (margin, padding, color, text)
│   │   ├── common.scss            ← 共通CSSエントリーファイル
│   │   └── top.scss               ← トップページ固有CSSエントリーファイル
│   │
│   ├── js/                        ← JavaScript
│   │   ├── common.js              ← 全ページ共通JS (スクロール・メニュー・AOS初期化)
│   │   ├── cookie.js              ← GDPR Cookie同意バナー (自動ロード)
│   │   └── top.js                 ← トップページ専用JS (Slickスライダー等)
│   │
│   ├── images/                    ← 画像素材
│   │   ├── common/                ← 全ページ共通画像 (favicon, logo 等)
│   │   └── top/                   ← トップページ専用画像
│   │
│   └── vendor/                    ← 外部ライブラリ (そのままコピー)
│       ├── jquery/                ← jQuery 3.5.1 (自動ロード)
│       ├── aos/                   ← AOS アニメーション
│       ├── slick/                 ← Slick スライダー
│       ├── scrollable/            ← ScrollHint
│       └── yubinbango/            ← 郵便番号→住所変換
│
├── index.ejs                      ← トップページ
├── sample.ejs                     ← サンプルページ
└── about/
    └── index.ejs                  ← about ページ
```

---

## 📝 開発ガイド (src 内での作業手順)

### ページの作成方法

**ルート直下のページ** (例: `/contact`)
1. `src/contact.ejs` を作成 → ビルド後 `public/contact.html` が出力される

**サブディレクトリのページ** (例: `/service/`)
1. `src/service/index.ejs` を作成 → ビルド後 `public/service/index.html` が出力される

各ページの先頭にはFront Matterブロック (`---` で囲む) を記述します：
```ejs
---
layout: _default
title: ページタイトル
description: SEO用の説明文
keyword: キーワード1, キーワード2
vendorcss: ['aos/aos','slick/slick']
vendorjs: ['aos/aos','slick/slick.min']
css: ['common','contact']
js: ['common','contact']
page: contact
---
<main class="p-contact">
    <div class="l-container">
        <h1>お問い合わせ</h1>
    </div>
</main>
```

**Front Matterの各項目:**

| 項目         | 必須 | 説明                                                                            |
| ------------ | ---- | ------------------------------------------------------------------------------- |
| `layout`     | ✅   | 使用するレイアウトファイル (`_default` → `src/layouts/_default.ejs`)               |
| `title`      | ✅   | `<title>` タグと `og:title` に出力                                               |
| `description`| ❌   | `<meta name="description">` と `og:description` に出力                          |
| `keyword`    | ❌   | `<meta name="keywords">` に出力                                                 |
| `vendorcss`  | ❌   | 外部CSSの配列。`src/assets/vendor/` からの相対パス (拡張子不要)                    |
| `vendorjs`   | ❌   | 外部JSの配列。`src/assets/vendor/` からの相対パス (拡張子不要)                     |
| `css`        | ❌   | ページ用CSSの配列。`src/assets/scss/` 内のSCSSファイル名 (拡張子不要)              |
| `js`         | ❌   | ページ用JSの配列。`src/assets/js/` 内のJSファイル名 (拡張子不要)                   |
| `page`       | ❌   | ページ識別子。ヘッダーで `<h1>` / `<div>` の切り替えに使用される (`top` のみ `<h1>`) |

### CSS / SCSS の追加方法

**新しいページ用のスタイルを追加する場合** (例: `contact` ページ)：

1. **SCSSファイルを作成:**
   - `src/assets/scss/page/contact/_index.scss` を作成
   - 先頭に `@use "../../global" as *;` を追加して変数やmixinを使えるようにする

2. **CSSエントリーファイルを作成:**
   - `src/assets/scss/contact.scss` を作成
   - 内容: `@use "page/contact";`

3. **Front Matterに宣言:**
   - EJSファイルの `css:` 配列に `'contact'` を追加

**SCSSの構成ルール:**
- ファイル名が `_` で始まるもの (例: `_header.scss`) はパーシャルファイル。直接CSSに変換されず、他のファイルから `@use` でインポートされる
- ファイル名が `_` で始まらないSCSSファイル (例: `common.scss`, `top.scss`) がCSSへの変換対象

**SCSS内でのglobal変数・関数の使い方:**
```scss
@use "../../global" as *;

.p-contact {
    // レスポンシブ font-size
    &__title {
        @extend %fz-24;  // モバイル20px → PC24px 自動レスポンシブ
    }

    // ブレークポイント
    &__grid {
        display: block;
        @include mq(md) {   // 768px 以上
            display: grid;
        }
    }

    // rem変換
    &__box {
        padding: rem(20);  // 20px → 1.25rem
    }

    // clamp (流体フォント)
    &__text {
        font-size: clamped(14, 18, 768, 1600);  // 768px時14px → 1600px時18px
    }
}
```

### JavaScript の追加方法

1. `src/assets/js/contact.js` を作成
2. Front Matterの `js:` 配列に `'contact'` を追加

**jQuery の使用:** レイアウトが jQuery を自動ロードするため、宣言なしで使用可能
```js
(function ($) {
    $(function () {
        // DOMReady時の処理
    });
})(jQuery);
```

### 画像の追加方法

1. `src/assets/images/` にファイルを配置
   - ページごとにサブフォルダを作成 (例: `src/assets/images/contact/`)
   - 共通画像は `src/assets/images/common/` に配置
2. `.jpg` / `.png` → 自動的に `.webp` に変換して `public/` に出力
3. `.svg` / `.gif` / `.ico` / `.webp` → そのままコピー
4. HTML内では `.webp` 拡張子で参照する:
   ```html
   <img src="<%= assetsDir %>assets/images/contact/photo.webp" alt="">
   ```

### 外部ライブラリの追加方法

1. `src/assets/vendor/[ライブラリ名]/` にCSS/JSファイルを配置
2. Front Matterで使用宣言:
   ```
   vendorcss: ['ライブラリ名/ファイル名']
   vendorjs: ['ライブラリ名/ファイル名']
   ```

---

## 🚀 CI/CD デプロイ設定

### 手順1: `deploy-config.json` を設定
```json
{
  "server": "JLWEB",
  "project_dir": "your_project_name",
  "source_folder": "public",
  "has_build_step": true,
  "build_command": "npm run build",
  "basic_auth": {
    "username": "user",
    "password": "pass"
  }
}
```

### 手順2: GitHub Secrets を設定
Settings > Secrets and variables > Actions で `JLWEB_CONFIG` を作成:
```json
{
  "host": "ftp.example.com",
  "user": "ftp_username",
  "pass": "ftp_password",
  "ftp_dir": "./public_html/client/github_deploy",
  "root_path": "/home/username/public_html/client/github_deploy"
}
```

### 手順3: デプロイの実行
`main` ブランチへプッシュすると自動デプロイされる。

---

## ✨ テンプレート機能の詳細解説

### 1. EJS テンプレートエンジン + Front Matter
- `gray-matter` で各ページの先頭に記述されたYAMLメタデータを解析し、レイアウト (`_default.ejs`) がHTMLの `<head>` 内に `<title>`, `<meta>`, `<link>`, `<script>` タグを自動生成する。
- `<%- include() %>` によりヘッダー・フッターをコンポーネント化し、全ページで共通コードを共有する。
- Front Matterの `page` 値に基づき、ヘッダー内のロゴが `top` ページでは `<h1>` タグ、それ以外では `<div>` タグに自動切替する (SEO対策)。

### 2. SCSS 高度ビルドパイプライン
- **sass-embedded**: ネイティブ言語実装のコンパイラにより高速にSCSSを解析。
- **autoprefixer**: ベンダーprefixの自動付与。
- **cssnano**: 本番ビルド時にCSSファイルを極限まで圧縮。
- **postcss-sort-media-queries**: メディアクエリの順序を最適化し、出力CSSを最小化。
- **依存関係の自動追従**: パーシャルファイルの変更時、影響を受けるエントリーファイルのみを自動で再コンパイルする (差分ビルド)。

### 3. レスポンシブタイポグラフィシステム
- `_extend.scss` で `%fz-10` ～ `%fz-56` のプレースホルダーが定義済み。
- CSS `clamp()` を使い、指定したブレークポイント間でフォントサイズが流体的にスケーリング。
- 使い方: `@extend %fz-24;` の1行でモバイルとPC両方のレスポンシブフォントが適用される。

### 4. ブレークポイントシステム
| 名前   | 条件               |
| ------ | ------------------|
| `m-sx` | max-width: 424px  |
| `sd`   | min-width: 600px  |
| `md`   | min-width: 768px  |
| `ld`   | min-width: 1024px |
| `lg`   | min-width: 1200px |
| `xd`   | min-width: 1440px |

使い方: `@include mq(md) { ... }`

### 5. SCSS ヘルパー関数
| 関数                                   | 説明                                        | 例                                     |
| -------------------------------------- | ------------------------------------------- | -------------------------------------- |
| `rem($px)`                             | px を rem に変換 (基準: 16px)                 | `rem(20)` → `1.25rem`                  |
| `vw($v, $w)`                           | px を vw に変換                              | `vw(100, 375)` → `26.6667vw`          |
| `clamped($min, $max, $minBP, $maxBP)`  | CSS clamp() で流体サイズを生成                | `clamped(14, 18, 768, 1600)`           |

### 6. 画像自動WebP変換 (sharp)
`.jpg` / `.png` ファイルをビルド時に自動的に `.webp` (品質90%) に変換。`.svg`, `.gif`, `.ico`, `.webp` はそのままコピー。動画ファイル (`.mp4`, `.webm`, `.ogg`) もサポート。

### 7. Browser-Sync + Chokidar ライブリロード
- `chokidar` がファイル変更を検知し、変更されたファイルのみを差分ビルド。
- `browser-sync` がブラウザを自動リロードする。CSS変更時はページリロードなしでスタイルだけ更新。

### 8. 組み込みJS機能
- **common.js**: スムーズスクロール、スクロール時のヘッダー固定、メニュートグル (モバイル)、AOS/ScrollHint初期化、IntersectionObserverによるフェードアニメーション
- **cookie.js**: GDPR Cookie同意バナー (365日間の記憶)。全ページで自動ロード。
- **jQuery** と **cookie.js** はレイアウトが自動でロードするため、Front Matterでの宣言は不要。

### 9. GitHub Actions CI/CD FTP デプロイ
- 初回デプロイ: 全ファイルアップロード + `.htaccess` / `.htpasswd` / `.repo_lock` の自動セットアップ。
- 以降のデプロイ: `git diff` を使い変更ファイルのみアップロード (差分デプロイ)。
- Basic認証による閲覧制限を自動設定。
- `.repo_lock` による排他制御: 他のリポジトリからの誤上書きを防止。

---
---

# Tiếng Việt

# 📦 Template JLine HTML

Template dự án web tĩnh sử dụng EJS + SCSS + JavaScript. Tích hợp hệ thống build tự động, hot-reload, và CI/CD deploy lên FTP server.

---

## 💻 Yêu cầu hệ thống

| Công cụ  | Phiên bản      |
| -------- | -------------- |
| Node.js  | v20 trở lên    |
| npm      | v9 trở lên     |
| Git      | v2 trở lên     |

**Hướng dẫn cài đặt:**
- **Windows**: [nvm-windows](https://github.com/coreybutler/nvm-windows) hoặc [trình cài đặt chính thức](https://nodejs.org/)
- **Mac**: `brew install node` hoặc [nvm](https://github.com/nvm-sh/nvm)
- **Linux**: Khuyến nghị dùng [nvm](https://github.com/nvm-sh/nvm) (`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`)

---

## 🚀 Cài đặt & Chạy dự án

### 1. Clone dự án
```bash
git clone https://github.com/jline-coding/TEMPLATE_HTML
cd TEMPLATE_HTML
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Chạy môi trường phát triển
```bash
npm run dev
```
- Theo dõi thay đổi trong `src/`, tự động build
- Trình duyệt tự mở tại `http://localhost:8080`
- Hot-reload khi lưu file

### 4. Build production
```bash
npm run build
```
- Xuất file đã nén CSS, chuyển đổi ảnh WebP và tối ưu hoá vào thư mục `public/`

### 5. Xóa thư mục build
```bash
npm run clean
```

---

## 📁 Cấu trúc thư mục src

```
src/
├── layouts/                       ← Layout dùng chung
│   ├── _default.ejs               ← Layout chính (khung HTML toàn trang)
│   ├── _header.ejs                ← Component header
│   └── _footer.ejs                ← Component footer
│
├── assets/
│   ├── scss/                      ← Stylesheet (SCSS)
│   │   ├── global/                ← Biến thiết kế, hàm, mixin (không xuất CSS trực tiếp)
│   │   │   ├── _breakpoints.scss  ← Định nghĩa breakpoint responsive
│   │   │   ├── _color.scss        ← Biến màu sắc
│   │   │   ├── _font.scss         ← Biến font chữ
│   │   │   ├── _content-width.scss← Chiều rộng nội dung
│   │   │   ├── _function.scss     ← Hàm rem(), vw(), clamped()
│   │   │   ├── _mixin.scss        ← Mixin dùng chung
│   │   │   └── _extend.scss       ← Placeholder font-size responsive (%fz-10 → %fz-56)
│   │   ├── foundation/            ← Reset CSS và style cơ bản
│   │   ├── layout/                ← Bố cục chung (container)
│   │   ├── component/             ← UI components (header, footer, btn, texts, titles...)
│   │   ├── page/                  ← Style riêng từng trang (common/, top/...)
│   │   ├── utilities/             ← Class tiện ích (margin, padding, color, text)
│   │   ├── common.scss            ← File entry CSS chung (load cho mọi trang)
│   │   └── top.scss               ← File entry CSS riêng trang chủ
│   │
│   ├── js/                        ← JavaScript
│   │   ├── common.js              ← JS chung (scroll, menu, AOS, fade animation)
│   │   ├── cookie.js              ← Banner đồng ý Cookie GDPR (tự động load)
│   │   └── top.js                 ← JS riêng trang chủ (Slick slider...)
│   │
│   ├── images/                    ← Hình ảnh
│   │   ├── common/                ← Ảnh dùng chung (favicon, logo...)
│   │   └── top/                   ← Ảnh riêng trang chủ
│   │
│   └── vendor/                    ← Thư viện bên ngoài (copy nguyên bản)
│       ├── jquery/                ← jQuery 3.5.1 (tự động load)
│       ├── aos/                   ← AOS animation
│       ├── slick/                 ← Slick slider
│       ├── scrollable/            ← ScrollHint
│       └── yubinbango/            ← Chuyển đổi mã bưu điện → địa chỉ
│
├── index.ejs                      ← Trang chủ
├── sample.ejs                     ← Trang mẫu
└── about/
    └── index.ejs                  ← Trang about
```

---

## 📝 Hướng dẫn phát triển (làm việc trong src)

### Tạo trang mới

**Trang ở thư mục gốc** (ví dụ: `/contact`):
1. Tạo file `src/contact.ejs` → Build ra `public/contact.html`

**Trang con trong thư mục** (ví dụ: `/service/`):
1. Tạo file `src/service/index.ejs` → Build ra `public/service/index.html`

Mỗi trang bắt buộc có khối Front Matter (`---`) ở đầu file:
```ejs
---
layout: _default
title: Tiêu đề trang
description: Mô tả cho SEO
keyword: từ khóa 1, từ khóa 2
vendorcss: ['aos/aos','slick/slick']
vendorjs: ['aos/aos','slick/slick.min']
css: ['common','contact']
js: ['common','contact']
page: contact
---
<main class="p-contact">
    <div class="l-container">
        <h1>Liên hệ</h1>
    </div>
</main>
```

**Giải thích các trường Front Matter:**

| Trường       | Bắt buộc | Mô tả                                                                              |
| ------------ | -------- | ----------------------------------------------------------------------------------- |
| `layout`     | ✅       | Layout sử dụng (`_default` → `src/layouts/_default.ejs`)                            |
| `title`      | ✅       | Xuất ra thẻ `<title>` và `og:title`                                                 |
| `description`| ❌       | Xuất ra `<meta name="description">` và `og:description`                             |
| `keyword`    | ❌       | Xuất ra `<meta name="keywords">`                                                    |
| `vendorcss`  | ❌       | Mảng CSS thư viện. Đường dẫn từ `src/assets/vendor/` (không ghi đuôi `.css`)        |
| `vendorjs`   | ❌       | Mảng JS thư viện. Đường dẫn từ `src/assets/vendor/` (không ghi đuôi `.js`)          |
| `css`        | ❌       | Mảng CSS riêng trang. Tên file SCSS trong `src/assets/scss/` (không ghi đuôi `.css`) |
| `js`         | ❌       | Mảng JS riêng trang. Tên file JS trong `src/assets/js/` (không ghi đuôi `.js`)       |
| `page`       | ❌       | Định danh trang. Logo trong header sẽ dùng `<h1>` nếu `page: top`, còn lại dùng `<div>` (SEO) |

### Thêm CSS / SCSS

**Thêm style cho một trang mới** (ví dụ: trang `contact`):

1. **Tạo file SCSS trang:**
   - Tạo `src/assets/scss/page/contact/_index.scss`
   - Thêm dòng đầu: `@use "../../global" as *;` để sử dụng biến và mixin

2. **Tạo file entry CSS:**
   - Tạo `src/assets/scss/contact.scss`
   - Nội dung: `@use "page/contact";`

3. **Khai báo trong Front Matter:**
   - Thêm `'contact'` vào mảng `css:` trong file EJS

**Quy tắc SCSS:**
- File bắt đầu bằng `_` (ví dụ: `_header.scss`) là file partial — không được compile trực tiếp thành CSS, chỉ được import bởi file khác qua `@use`
- File KHÔNG bắt đầu bằng `_` (ví dụ: `common.scss`, `top.scss`) là file entry — sẽ được compile thành CSS

**Cách dùng biến/hàm global trong SCSS:**
```scss
@use "../../global" as *;

.p-contact {
    // Font-size responsive tự động
    &__title {
        @extend %fz-24;  // Mobile 20px → PC 24px tự co giãn
    }

    // Breakpoint
    &__grid {
        display: block;
        @include mq(md) {   // Từ 768px trở lên
            display: grid;
        }
    }

    // Chuyển đổi px sang rem
    &__box {
        padding: rem(20);  // 20px → 1.25rem
    }

    // Fluid font size dùng clamp
    &__text {
        font-size: clamped(14, 18, 768, 1600);  // 768px→14px, 1600px→18px
    }
}
```

### Thêm JavaScript

1. Tạo file `src/assets/js/contact.js`
2. Thêm `'contact'` vào mảng `js:` trong Front Matter

**Sử dụng jQuery:** Layout tự động load jQuery nên dùng được ngay không cần khai báo
```js
(function ($) {
    $(function () {
        // Code chạy khi DOM ready
    });
})(jQuery);
```

### Thêm hình ảnh

1. Đặt file vào `src/assets/images/`
   - Tạo thư mục con theo trang (ví dụ: `src/assets/images/contact/`)
   - Ảnh dùng chung đặt trong `src/assets/images/common/`
2. `.jpg` / `.png` → Tự động chuyển thành `.webp` khi build
3. `.svg` / `.gif` / `.ico` / `.webp` → Copy nguyên bản
4. Trong HTML tham chiếu bằng đuôi `.webp`:
   ```html
   <img src="<%= assetsDir %>assets/images/contact/photo.webp" alt="">
   ```

### Thêm thư viện ngoài

1. Đặt file CSS/JS vào `src/assets/vendor/[tên-thư-viện]/`
2. Khai báo trong Front Matter:
   ```
   vendorcss: ['tên-thư-viện/tên-file']
   vendorjs: ['tên-thư-viện/tên-file']
   ```

---

## 🚀 Cài đặt CI/CD Deploy

### Bước 1: Cấu hình `deploy-config.json`
```json
{
  "server": "JLWEB",
  "project_dir": "ten_du_an",
  "source_folder": "public",
  "has_build_step": true,
  "build_command": "npm run build",
  "basic_auth": {
    "username": "user",
    "password": "pass"
  }
}
```

### Bước 2: Tạo GitHub Secrets
Vào Settings > Secrets and variables > Actions, tạo secret tên `JLWEB_CONFIG`:
```json
{
  "host": "ftp.example.com",
  "user": "ftp_username",
  "pass": "ftp_password",
  "ftp_dir": "./public_html/client/github_deploy",
  "root_path": "/home/username/public_html/client/github_deploy"
}
```

### Bước 3: Deploy
Push code lên nhánh `main` → GitHub Actions tự động build và deploy.

---

## ✨ Giải thích chi tiết các tính năng của Template

### 1. EJS Template Engine + Front Matter
- Thư viện `gray-matter` phân tích metadata YAML ở đầu mỗi file EJS. Layout `_default.ejs` đọc các trường này để tự động sinh thẻ `<title>`, `<meta>`, `<link>`, `<script>` trong `<head>`.
- `<%- include() %>` giúp tách Header và Footer thành component riêng, dùng chung cho tất cả các trang.
- Dựa theo giá trị `page` trong Front Matter, header tự động đổi logo giữa thẻ `<h1>` (khi `page: top`) và `<div>` (các trang khác) — đây là kỹ thuật tối ưu SEO.

### 2. Pipeline biên dịch SCSS nâng cao
- **sass-embedded**: Bộ biên dịch viết bằng ngôn ngữ native, tốc độ biên dịch cực nhanh.
- **autoprefixer**: Tự động thêm vendor prefix cho các trình duyệt.
- **cssnano**: Nén CSS xuống kích thước tối thiểu khi build production.
- **postcss-sort-media-queries**: Sắp xếp lại media query theo thứ tự tối ưu, giúp giảm dung lượng CSS.
- **Dependency tracking**: Khi sửa file partial (`_*.scss`), hệ thống tự phân tích đồ thị phụ thuộc và chỉ compile lại đúng những file entry bị ảnh hưởng (incremental build).

### 3. Hệ thống Typography Responsive
- File `_extend.scss` định nghĩa sẵn placeholder từ `%fz-10` đến `%fz-56`.
- Sử dụng CSS `clamp()` để font-size tự co giãn mượt giữa mobile và desktop.
- Chỉ cần viết `@extend %fz-24;` — một dòng duy nhất áp dụng responsive font cho cả mobile và PC.

### 4. Hệ thống Breakpoint
| Tên    | Điều kiện          |
| ------ | ------------------|
| `m-sx` | max-width: 424px  |
| `sd`   | min-width: 600px  |
| `md`   | min-width: 768px  |
| `ld`   | min-width: 1024px |
| `lg`   | min-width: 1200px |
| `xd`   | min-width: 1440px |

Cách dùng: `@include mq(md) { ... }`

### 5. Hàm tiện ích SCSS
| Hàm                                   | Mô tả                                       | Ví dụ                                  |
| -------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `rem($px)`                             | Chuyển px sang rem (cơ sở: 16px)              | `rem(20)` → `1.25rem`                  |
| `vw($v, $w)`                           | Chuyển px sang vw                             | `vw(100, 375)` → `26.6667vw`          |
| `clamped($min, $max, $minBP, $maxBP)`  | Tạo fluid size bằng CSS clamp()               | `clamped(14, 18, 768, 1600)`           |

### 6. Tự động chuyển đổi ảnh sang WebP (sharp)
File `.jpg` / `.png` được tự động convert thành `.webp` (chất lượng 90%) khi build. Các định dạng `.svg`, `.gif`, `.ico`, `.webp` được copy nguyên bản. Hỗ trợ cả video (`.mp4`, `.webm`, `.ogg`).

### 7. Browser-Sync + Chokidar Live Reload
- `chokidar` phát hiện thay đổi file, chỉ build lại phần bị thay đổi (differential build).
- `browser-sync` tự động reload trình duyệt. Khi thay đổi CSS, chỉ cập nhật style mà không reload toàn trang.

### 8. Các tính năng JS tích hợp sẵn
- **common.js**: Smooth scroll, header cố định khi cuộn, menu toggle (mobile), khởi tạo AOS/ScrollHint, fade animation bằng IntersectionObserver.
- **cookie.js**: Banner đồng ý Cookie theo chuẩn GDPR (lưu lựa chọn 365 ngày). Tự động load cho mọi trang.
- **jQuery** và **cookie.js** được layout tự động load — không cần khai báo trong Front Matter.

### 9. GitHub Actions CI/CD FTP Deploy
- Lần đầu: Upload toàn bộ file + tự động tạo `.htaccess` / `.htpasswd` / `.repo_lock`.
- Các lần sau: Dùng `git diff` chỉ upload file thay đổi (deploy tăng tốc).
- Tự động thiết lập Basic Auth để bảo vệ site.
- File `.repo_lock` chống ghi đè nhầm từ repo khác.

---
---

# English

# 📦 Template JLine HTML

A static website template using EJS + SCSS + JavaScript. Includes an automated build system, hot-reload, and CI/CD FTP deployment.

---

## 💻 System Requirements

| Tool     | Version        |
| -------- | -------------- |
| Node.js  | v20 or higher  |
| npm      | v9 or higher   |
| Git      | v2 or higher   |

**Installation guides:**
- **Windows**: [nvm-windows](https://github.com/coreybutler/nvm-windows) or the [official installer](https://nodejs.org/)
- **Mac**: `brew install node` or [nvm](https://github.com/nvm-sh/nvm)
- **Linux**: [nvm](https://github.com/nvm-sh/nvm) is recommended (`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`)

---

## 🚀 Installation & Usage

### 1. Clone the repository
```bash
git clone https://github.com/jline-coding/TEMPLATE_HTML
cd TEMPLATE_HTML
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm run dev
```
- Watches `src/` for changes and auto-builds
- Opens your browser at `http://localhost:8080`
- Hot-reloads on file save

### 4. Build for production
```bash
npm run build
```
- Outputs minified CSS, WebP-converted images, and optimized assets into `public/`

### 5. Clean build output
```bash
npm run clean
```

---

## 📁 src Directory Structure

```
src/
├── layouts/                       ← Shared layouts
│   ├── _default.ejs               ← Main layout (full HTML skeleton)
│   ├── _header.ejs                ← Header component
│   └── _footer.ejs                ← Footer component
│
├── assets/
│   ├── scss/                      ← Stylesheets (SCSS)
│   │   ├── global/                ← Design tokens, functions, mixins (no direct CSS output)
│   │   │   ├── _breakpoints.scss  ← Responsive breakpoint definitions
│   │   │   ├── _color.scss        ← Color variables
│   │   │   ├── _font.scss         ← Font variables
│   │   │   ├── _content-width.scss← Content width definitions
│   │   │   ├── _function.scss     ← rem(), vw(), clamped() functions
│   │   │   ├── _mixin.scss        ← Reusable mixins
│   │   │   └── _extend.scss       ← Responsive font-size placeholders (%fz-10 to %fz-56)
│   │   ├── foundation/            ← CSS reset & base styles
│   │   ├── layout/                ← Layout modules (container)
│   │   ├── component/             ← Shared UI components (header, footer, btn, texts, titles...)
│   │   ├── page/                  ← Page-specific styles (common/, top/...)
│   │   ├── utilities/             ← Utility classes (margin, padding, color, text)
│   │   ├── common.scss            ← Common CSS entry file (loaded on every page)
│   │   └── top.scss               ← Top page CSS entry file
│   │
│   ├── js/                        ← JavaScript
│   │   ├── common.js              ← Shared JS (scroll, menu, AOS, fade animations)
│   │   ├── cookie.js              ← GDPR Cookie consent banner (auto-loaded)
│   │   └── top.js                 ← Top page JS (Slick slider...)
│   │
│   ├── images/                    ← Image assets
│   │   ├── common/                ← Shared images (favicon, logo...)
│   │   └── top/                   ← Top page images
│   │
│   └── vendor/                    ← Third-party libraries (copied as-is)
│       ├── jquery/                ← jQuery 3.5.1 (auto-loaded)
│       ├── aos/                   ← AOS scroll animation
│       ├── slick/                 ← Slick slider
│       ├── scrollable/            ← ScrollHint
│       └── yubinbango/            ← Postal code to address converter
│
├── index.ejs                      ← Top page
├── sample.ejs                     ← Sample page
└── about/
    └── index.ejs                  ← About page
```

---

## 📝 Development Guide (Working Inside src)

### Creating Pages

**Root-level page** (e.g., `/contact`):
1. Create `src/contact.ejs` → Builds to `public/contact.html`

**Subdirectory page** (e.g., `/service/`):
1. Create `src/service/index.ejs` → Builds to `public/service/index.html`

Each page must have a Front Matter block (`---`) at the top:
```ejs
---
layout: _default
title: Page Title
description: SEO description
keyword: keyword1, keyword2
vendorcss: ['aos/aos','slick/slick']
vendorjs: ['aos/aos','slick/slick.min']
css: ['common','contact']
js: ['common','contact']
page: contact
---
<main class="p-contact">
    <div class="l-container">
        <h1>Contact</h1>
    </div>
</main>
```

**Front Matter fields explained:**

| Field        | Required | Description                                                                         |
| ------------ | -------- | ----------------------------------------------------------------------------------- |
| `layout`     | ✅       | Layout file to use (`_default` → `src/layouts/_default.ejs`)                         |
| `title`      | ✅       | Output to `<title>` tag and `og:title`                                               |
| `description`| ❌       | Output to `<meta name="description">` and `og:description`                          |
| `keyword`    | ❌       | Output to `<meta name="keywords">`                                                   |
| `vendorcss`  | ❌       | Array of vendor CSS files. Relative path from `src/assets/vendor/` (no `.css` ext)   |
| `vendorjs`   | ❌       | Array of vendor JS files. Relative path from `src/assets/vendor/` (no `.js` ext)     |
| `css`        | ❌       | Array of page CSS. SCSS filename in `src/assets/scss/` (no `.css` ext)               |
| `js`         | ❌       | Array of page JS. JS filename in `src/assets/js/` (no `.js` ext)                     |
| `page`       | ❌       | Page identifier. Header logo uses `<h1>` when `page: top`, `<div>` otherwise (SEO)  |

### Adding CSS / SCSS

**Adding styles for a new page** (e.g., `contact` page):

1. **Create the page SCSS file:**
   - Create `src/assets/scss/page/contact/_index.scss`
   - Add `@use "../../global" as *;` at the top to access variables and mixins

2. **Create the CSS entry file:**
   - Create `src/assets/scss/contact.scss`
   - Content: `@use "page/contact";`

3. **Declare in Front Matter:**
   - Add `'contact'` to the `css:` array in the EJS file

**SCSS naming rules:**
- Files starting with `_` (e.g., `_header.scss`) are partials — they are not compiled to CSS directly, only imported by other files via `@use`
- Files NOT starting with `_` (e.g., `common.scss`, `top.scss`) are entry files — they will be compiled to CSS

**Using global variables/functions in SCSS:**
```scss
@use "../../global" as *;

.p-contact {
    // Responsive font-size
    &__title {
        @extend %fz-24;  // Mobile 20px → PC 24px auto-responsive
    }

    // Breakpoints
    &__grid {
        display: block;
        @include mq(md) {   // 768px and above
            display: grid;
        }
    }

    // px to rem conversion
    &__box {
        padding: rem(20);  // 20px → 1.25rem
    }

    // Fluid font size using clamp
    &__text {
        font-size: clamped(14, 18, 768, 1600);  // 14px at 768px → 18px at 1600px
    }
}
```

### Adding JavaScript

1. Create `src/assets/js/contact.js`
2. Add `'contact'` to the `js:` array in Front Matter

**Using jQuery:** The layout auto-loads jQuery, so it's available without declaration
```js
(function ($) {
    $(function () {
        // Code runs on DOM ready
    });
})(jQuery);
```

### Adding Images

1. Place files in `src/assets/images/`
   - Create per-page subfolders (e.g., `src/assets/images/contact/`)
   - Shared images go in `src/assets/images/common/`
2. `.jpg` / `.png` → Automatically converted to `.webp` during build
3. `.svg` / `.gif` / `.ico` / `.webp` → Copied as-is
4. Reference images with `.webp` extension in HTML:
   ```html
   <img src="<%= assetsDir %>assets/images/contact/photo.webp" alt="">
   ```

### Adding Third-Party Libraries

1. Place CSS/JS files in `src/assets/vendor/[library-name]/`
2. Declare in Front Matter:
   ```
   vendorcss: ['library-name/file-name']
   vendorjs: ['library-name/file-name']
   ```

---

## 🚀 CI/CD Deployment Setup

### Step 1: Configure `deploy-config.json`
```json
{
  "server": "JLWEB",
  "project_dir": "your_project_name",
  "source_folder": "public",
  "has_build_step": true,
  "build_command": "npm run build",
  "basic_auth": {
    "username": "user",
    "password": "pass"
  }
}
```

### Step 2: Set up GitHub Secrets
Go to Settings > Secrets and variables > Actions, create a secret named `JLWEB_CONFIG`:
```json
{
  "host": "ftp.example.com",
  "user": "ftp_username",
  "pass": "ftp_password",
  "ftp_dir": "./public_html/client/github_deploy",
  "root_path": "/home/username/public_html/client/github_deploy"
}
```

### Step 3: Deploy
Push code to the `main` branch → GitHub Actions automatically builds and deploys.

---

## ✨ Detailed Feature Breakdown

### 1. EJS Template Engine + Front Matter
- `gray-matter` parses YAML metadata at the top of each EJS file. The `_default.ejs` layout reads these fields to automatically generate `<title>`, `<meta>`, `<link>`, and `<script>` tags in `<head>`.
- `<%- include() %>` separates Header and Footer into reusable components shared across all pages.
- Based on the `page` value in Front Matter, the header automatically switches the logo between `<h1>` (when `page: top`) and `<div>` (other pages) — an SEO optimization technique.

### 2. Advanced SCSS Build Pipeline
- **sass-embedded**: Native-speed SCSS compiler for fast compilation.
- **autoprefixer**: Automatically adds vendor prefixes for browser compatibility.
- **cssnano**: Minifies CSS to the smallest possible size in production builds.
- **postcss-sort-media-queries**: Reorders media queries optimally to reduce CSS output size.
- **Dependency tracking**: When a partial file (`_*.scss`) changes, the system analyzes the dependency graph and recompiles only the affected entry files (incremental build).

### 3. Responsive Typography System
- `_extend.scss` provides pre-defined placeholders from `%fz-10` to `%fz-56`.
- Uses CSS `clamp()` for fluid font scaling between breakpoints.
- Just write `@extend %fz-24;` — a single line applies responsive font sizes for both mobile and desktop.

### 4. Breakpoint System
| Name   | Condition          |
| ------ | ------------------|
| `m-sx` | max-width: 424px  |
| `sd`   | min-width: 600px  |
| `md`   | min-width: 768px  |
| `ld`   | min-width: 1024px |
| `lg`   | min-width: 1200px |
| `xd`   | min-width: 1440px |

Usage: `@include mq(md) { ... }`

### 5. SCSS Helper Functions
| Function                                | Description                              | Example                                |
| --------------------------------------- | ---------------------------------------- | -------------------------------------- |
| `rem($px)`                              | Convert px to rem (base: 16px)           | `rem(20)` → `1.25rem`                  |
| `vw($v, $w)`                            | Convert px to vw                         | `vw(100, 375)` → `26.6667vw`          |
| `clamped($min, $max, $minBP, $maxBP)`   | Generate fluid size using CSS clamp()    | `clamped(14, 18, 768, 1600)`           |

### 6. Automatic WebP Image Conversion (sharp)
`.jpg` / `.png` files are automatically converted to `.webp` (quality 90%) during build. `.svg`, `.gif`, `.ico`, `.webp` are copied as-is. Video files (`.mp4`, `.webm`, `.ogg`) are also supported.

### 7. Browser-Sync + Chokidar Live Reload
- `chokidar` detects file changes and triggers rebuilds only for modified files (differential build).
- `browser-sync` automatically reloads the browser. For CSS changes, only styles are updated without a full page reload.

### 8. Built-in JS Features
- **common.js**: Smooth scrolling, sticky header on scroll, mobile menu toggle, AOS/ScrollHint initialization, fade animations via IntersectionObserver.
- **cookie.js**: GDPR-compliant cookie consent banner (remembers choice for 365 days). Auto-loaded on every page.
- **jQuery** and **cookie.js** are auto-loaded by the layout — no Front Matter declaration needed.

### 9. GitHub Actions CI/CD FTP Deployment
- First deploy: Uploads all files + auto-generates `.htaccess` / `.htpasswd` / `.repo_lock`.
- Subsequent deploys: Uses `git diff` to upload only changed files (incremental deploy).
- Automatically sets up Basic Auth to protect the site.
- `.repo_lock` file prevents accidental overwrites from other repositories.
