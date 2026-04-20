<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- meta -->
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, address=no, email=no">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="sample">
  <meta property="og:type" content="website">
  <meta property="og:url" content>
  <meta property="og:image" content>
  <meta property="og:site_name" content="">
  <meta property="og:description" content="description About">
  <meta name="description" content="description About">
  <meta name="keywords" content="keyword About">
  <link rel="shortcut icon" type="image/x-icon" href="./../assets/images/common/favicon.ico" >
    <link rel="canonical" href="https://jlweb.jp/sample/">
  <title>sample</title>
  <!-- link -->  
      <link rel="stylesheet" href="./../assets/vendor/slick/slick.css">
  
    <link rel="stylesheet" href="./../assets/css/common.css">
    <link rel="stylesheet" href="./../assets/css/sample.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="wrapper" class="body-wrapper">
      <?php $assetsDir = './../'; $page = 'sample'; include __DIR__ . '/../components/header_01.php'; ?>
    <main class="p-about">   
    
    <!-- Bạn có thể nhúng Component bất kỳ ở bất kỳ đâu trong trang bằng lệnh includeComponent này! -->
    <?php include __DIR__ . '/../components/sidebar.php'; ?>

    <div class="c-loading">
        <div class="c-loading__inner">
            <div class="c-loading__content">
                <div class="c-loading__item"></div>
                <div class="c-loading__item"></div>
            </div>
        </div>
    </div>   
    <h1>sample</h1>
    <img src="../assets/images/common/img_dummy.webp" alt="">
</main>
    
      <?php include __DIR__ . '/../components/footer_01.php'; ?>
    <div data-gdpr="wrap" id="cookiewrap">
      <div class="inner">
        <p class="close"><a href="javascript:void(0)" data-gdpr="button" style="display: inline-block;">同意する</a></p>
        <p class="txt">当サイトではCookieを使用します。Cookieの使用に関する詳細は「プライバシーポリシー」をご覧ください。</p>
      </div>      
    </div>
    <!-- script -->  

    <script src="./../assets/vendor/jquery/jquery-4.0.0.min.js"></script>    
    <script src="./../assets/js/cookie.js"></script>
          <script src="./../assets/vendor/slick/slick.min.js"></script>
              <script src="./../assets/js/inview.js"></script>
          <script src="./../assets/js/common.js"></script>
          <script src="./../assets/js/sample.js"></script>
     
  </div>
  
</body>
</html>