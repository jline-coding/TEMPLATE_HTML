$config{'about'} = 'MailformPro 4.3.5 - 2026/01/03';

## 確認画面のタイプ
## 0: オーバーレイ / 1:フラット / 2: システムダイアログ / 3:確認なし
$config{'ConfirmationMode'} = 0;

## sendmailのパス
#$config{'sendmail'} = 'C:\sendmail\sendmail.exe';
$config{'sendmail'} = '/usr/sbin/sendmail';

## フォームの宛先
push @mailto,'support@synck.com';

## 管理者宛メールのCC・BCCの宛先
#$config{'admin_cc'} = 'support@synck.com';
#$config{'admin_bcc'} = 'support@synck.com';

## 自動返信メールのCC・BCCの宛先
#$config{'responder_cc'} = 'support@synck.com';
#$config{'responder_bcc'} = 'support@synck.com';

## 自動返信メールの差出人名
$config{'fromname'} = 'シンクグラフィカ';

## 自動返信メールの差出人メールアドレス
$config{'mailfrom'} = $mailto[0];

## 自動返信メールのreply-to
#$config{'replyto'} = '';

## 念のためBCC送信宛先 (解除する場合は下記1行をコメントアウト)
## 以下をコメントアウトしていない場合は自動返信メールの控えが届きます。
#$config{'bcc'} = $mailto[0];

## メールの差出人を固定 (0:無効 / 1:固定)
## 固定にした場合、Reply-Toにお客様のアドレスがセットされます。
$config{'fixed'} = 1;

## 通し番号の書式
$config{'SerialFormat'} = '<date>%04d';

## 通し番号への加算値
$config{'SerialBoost'} = 0;

## サンクスページのURL(URLかsend.cgiから見た相対パス)
$config{'ThanksPage'} = '../thanks.html?no=%s';

## 設置者に届くメールの件名
$config{'subject'} = '[ %s ] お問い合せフォームから';

## 設置者に届くメールの本文整形
$_TEXT{'posted'} = <<'__posted_body__';
<_mfp_jssemantics_>
<_mfp_date_>
お問い合せフォームより以下のメールを受付ました。
──────────────────────────
受付番号：<_mfp_serial_>
入力時間：<_mfp_input_time_>
確認時間：<_mfp_confirm_time_>
　送信元：<_mfp_referrer_>
支払金額：<_mfp_cartprice_>
　流入元：<_mfp_landing_referrer_>

待ち時間確認用URL
<_mfp_numticket_uri_>
予想待ち時間：<_mfp_numticket_wait_> 分程度
予想時間：<_mfp_numticket_datetime_>（実際の状況により前後します）
順番：<_mfp_numticket_qty_> 番目
受付番号：<_mfp_numticket_number_>
照会番号：<_mfp_numticket_code_>

<_resbody_>
──────────────────────────

<_mfp_env_>

━━━━━━━━━━━━━━━━━━━━━━━━━━
　※この署名はサンプルです。必ず変更してください※　
　シンクグラフィカ / SYNCKGRAPHICA
　〒003-0021 札幌市白石区栄通17丁目4-1
　TEL / 050-3390-0450　FAX / 011-887-0450
　http://www.synck.com
━━━━━━━━━━━━━━━━━━━━━━━━━━
__posted_body__

## ※※※！！！※※※！！！※※※！！！※※※！！！※※※！！！※※※
## 自動返信メールの件名 (有効にする場合は下記の行頭#を外してください。)
## ※※※！！！※※※！！！※※※！！！※※※！！！※※※！！！※※※

$config{"ReturnSubject"} = '[ %s ] お問い合せありがとうございました';

## 自動返信メールの本文
$_TEXT{'responder'} = <<'__return_body__';
<_姓_> 様
──────────────────────────

おすしのみ：<_ごはん_おすし_>
焼肉のみ：<_ごはん_焼肉_>
おすし＆焼肉：<_ごはん_おすし_焼肉_>
<_決済方法_銀行振込_><_決済方法_クレジット決済_>

この度はお問い合せ頂き誠にありがとうございました。
改めて担当者よりご連絡をさせていただきます。

─ご送信内容の確認─────────────────
受付番号：<_mfp_serial_>
<_resbody_>
──────────────────────────

このメールに心当たりの無い場合は、お手数ですが
下記連絡先までお問い合わせください。

この度はお問い合わせ重ねてお礼申し上げます。

━━━━━━━━━━━━━━━━━━━━━━━━━━
　※この署名はサンプルです。必ず変更してください※　
　シンクグラフィカ / SYNCKGRAPHICA
　〒003-0021 札幌市白石区栄通17丁目4-1
　TEL / 050-3390-0450　FAX / 011-887-0450
　http://www.synck.com
━━━━━━━━━━━━━━━━━━━━━━━━━━
__return_body__


####################################################
## セパレーターの設定
####################################################
## 改行を入れる場合は\nを挿入してください。
$config{'mfp_separator_1'} = "【送信者情報】\n";
$config{'mfp_separator_2'} = "\n【お問い合わせ内容】\n";


####################################################
## スパム対策関連
####################################################

## Javascriptが無効の場合は送信を許可しない(1:許可しない / 0:許可する)
$config{'DisabledJs'} = 1;

## リファラードメインチェック / 有効にする場合は行頭の#を削除
#$config{'PostDomain'} = $ENV{'HTTP_HOST'};

## 全文英語のスパム候補を除外(1:除外 / 0:除外しない)
$config{'EnglishSpamBlock'} = 1;

## リンク系スパム候補を除外(1:除外 / 0:除外しない)
$config{'LinkSpamBlock'} = 1;

## URLの送信を許可しない(1:許可しない / 0:許可する)
$config{'DisableURI'} = 1;


####################################################
## 有効期限など
####################################################

## 送信数制限
#$config{'limit'} = 100;

## 期限の書式は YYYY-MM-DD HH:MM:SS です。
## 受付開始日時
#$config{'OpenDate'} = '2013-01-01 06:21:00';

## 受付終了日時
#$config{'CloseDate'} = '2025-08-09 00:00:00';


$config{'dir.AddOns'} = './add-ons/';
@AddOns = ();
@Modules = ();

####################################################
## 拡張機能（旧アドオン、モジュール）
####################################################

## 設定ファイルを複数用意する必要がある場合、コメントを解除してください
#push @Modules,'MultiConfig';

## 動作チェック ※本番では消してください
push @AddOns,'OperationCheck.js';
push @Modules,'check';

## 迷惑メール対策 
push @AddOns,'ipblock.js';				## 連続送信ブロック機能
push @Modules,'ipblock';		## 連続送信ブロック機能
push @Modules,'taboowords';		## 禁止ワードの指定 [New]
push @AddOns,'taboowords/taboowords.js';## 禁止ワードの指定 [New]
push @Modules,'onetimetoken';		## [New] ワンタイムトークン
push @AddOns,'onetimetoken/onetimetoken.js';	## [New] ワンタイムトークン

## ショッピングカート
#push @AddOns,'cart/cart.js';			## ショッピングカート機能
#push @Modules,'cart';			## ショッピングカート機能

## AI機能 ChatGPT or Deepseek 機能 [New 4.3.5]
#push @Modules,'ChatGPT';
#push @Modules,'Deepseek';

## 予約カレンダー [New 4.3.2]
#push @AddOns,'calendar/calendar.js';
#push @Modules,'calendar';

## Discord通知
#push @Modules,'discord';

## [有償] 添付ファイル機能
#push @AddOns,'attachedfiles.js';
#push @Modules,'attachedfiles';

## [有償] 限定公開掲示板接続
#push @Modules,'UnlistedBBS';

####################################################
## その他のアドオン（Javascript関連の機能）
####################################################

push @AddOns,'smoothScroll.js';			## モバイル端末エラー時のスクロール調整
#push @AddOns,'charactercheck.js';		## 文字校正
#push @AddOns,'prefcode/prefcode.js';	## 郵便番号からの住所入力
#push @AddOns,'prefcodeadv/prefcode.js';## 郵便番号からの住所入力(高機能・高負荷)
#push @AddOns,'furigana.js';			## フリガナ(Firefox非対応)
#push @AddOns,'datelist.js';			## 日付リストの生成機能 [Update]
#push @AddOns,'toggle.js';				## 入力欄の可変
#push @AddOns,'ok.js';					## OKアドオン [New]
#push @AddOns,'okng.js';				## OKアドオン [New]
#push @AddOns,'nospace.js';				## スペースのみの入力を無効
#push @AddOns,'request/request.js';		## リクエスト機能
#push @AddOns,'phase.js';				## 段階的入力機能
#push @AddOns,'drilldown.js';			## ドリルダウン機能
#push @AddOns,'charformat.js';			## テキスト整形(Xperia非対応)
#push @AddOns,'noresume.js';			## 入力された内容をレジュームしない
#push @AddOns,'switching.js';			## スイッチング機能サンプル
#push @AddOns,'prevention.js';			## イタズラ防止
#push @AddOns,'wellcome.js';			## (技術デモ)ウェルカムメッセージ
#push @AddOns,'speechAPI.js';			## (技術デモ)音声入力
#push @AddOns,'WadaVoiceDemo.js';		## (技術デモ)音声ガイダンス
#push @AddOns,'progress.js';			## プログレスバー表示
#push @AddOns,'WTKConnect.js';			## WebsiteToolKit.jsとの連動
#push @AddOns,'submitdisabled.js';		## エラー時に送信ボタンを無効化
#push @AddOns,'sizeajustdisabled.js';	## 入力欄の自動調整機能を無効化
#push @AddOns,'defaultValue.js';		## 初期値を無効
#push @AddOns,'estimate.js';			## 見積計算(ベータ版)
#push @AddOns,'beforeunload.js';		## ページを離脱する際のアラート(ベータ版)
#push @AddOns,'setValue.js';			## 初期値をセット
#push @AddOns,'errorScroll.js';			## エラー時に対象エレメントまでスクロール(ベータ版)
#push @AddOns,'reserve.js';				## 予約受付 [New]
#push @AddOns,'pricefactor.js';			## 人数分の料金掛け算
#push @AddOns,'tax.js';					## 消費税計算 [New]
#push @AddOns,'email.js';				## メールアドレスのチェック(やや厳格)
#push @AddOns,'confirm.js';				## 確認用エレメント
#push @AddOns,'record.js';				## 記録用
#push @AddOns,'birthday.js';			## 生年月日選択補助
#push @AddOns,'unchecked.js';			## radioのチェック解除
#push @AddOns,'suggest/suggest.js';		## サジェスト機能
#push @AddOns,'search/search.js';		## サーチ機能
#push @AddOns,'guide.js';				## エレメントフォーカス時にガイドを表示
#push @AddOns,'firstfocus.js';			## ページ読み込み時に最初のエレメントにフォーカス
#push @AddOns,'submitblock.js';			## 未入力項目があるとき送信ブロック
#push @AddOns,'bootstrap.js';			## Bootstrapへの対応
#push @AddOns,'datelisten.js';			## 日付リストの生成機能 [Update]
#push @AddOns,'call/call.js';			## 商品呼び出し機能
#push @AddOns,'coupon/coupon.js';

#push @AddOns,'numticket.js';					## [New] 順番待ち受付システム
#push @AddOns,'yearmonth.js';					## [New] 年月選択補助
#push @AddOns,'estimate/estimate.js';			## [New] 見積リスト機能
#push @AddOns,'ticket/ticket.js';			## [New] 座席予約システム
#push @AddOns,'requiredColor.js'; ## [New 4.3.2] 必須入力欄の背景色を変える
#push @AddOns,'pricecheck.js'; ## [New 4.3.2] 価格チェック機能
#push @AddOns,'trace.js';		## [New 4.3.2]  サイトにどのドメイン経由ではいってきたか知るやつ
#push @AddOns,'reload.js';		## [New 4.3.2]  戻るボタンで戻ってきたときにリロードするやつ

####################################################
## その他のモジュール(CGIの追加機能)
####################################################

push @Modules,'logger';			## アクセス解析ログモジュール
#push @Modules,'thanks';		## サンクスページへの引き継ぎ
#push @Modules,'request';		## リクエスト機能
#push @Modules,'ISO-2022-JP';	## メールをJISで送信
#push @Modules,'HTMLMail';		## 自動返信メールにHTMLメールを追加
#push @Modules,'HTMLMailAdmin';	## 管理者宛メールにHTMLメールを追加
#push @Modules,'CSVExport';		## CSV保存機能
#push @Modules,'SQLExport';		## SQL発行機能
#push @Modules,'vCard';			## vCard機能
#push @Modules,'iCal';			## iCal連携機能
#push @Modules,'IPLogs';		## IPログトラッキング機能
#push @Modules,'PayPal';		## PayPal決済
#push @Modules,'SMTP';			## SMTP送信
#push @Modules,'SMTPS';			## SMTPS送信
#push @Modules,'SimpleMailHead';## シンプルメールヘッダ
#push @Modules,'MAILHEAD';		## メールヘッダのカスタマイズ
#push @Modules,'mailauth';		## メールアドレス認証
#push @Modules,'reqonce';		## 一度きりの送信
#push @Modules,'questionnaire';	## アンケート集計モジュール
#push @Modules,'GmailSMTP';		## GmailのSMTPを使う場合
#push @Modules,'regist';		## メールアドレスの登録・解除
#push @Modules,'ReplyTime';		## 応答時間計測
#push @Modules,'count';			## 集計モジュール
#push @Modules,'reserve';		## 予約管理モジュール
#push @Modules,'stress';		## ストレスチェック判定モジュール
#push @Modules,'csvatt';		## CSV添付機能
#push @Modules,'response';		## 応答文章分岐
#push @Modules,'referercheck';	## 厳密なリファラチェック
#push @Modules,'blacklist';		## ブラックリスト
#push @Modules,'suggest';		## サジェスト機能
#push @Modules,'search';		## サーチ機能
#push @Modules,'sendgrid';		## Sendgrid連携機能
#push @Modules,'call';			## 商品呼び出し機能

#push @Modules,'radiovalue';
#push @Modules,'demo';			## デモ
#push @Modules,'MFPOrderConnect';	## MFP Order Connect API
#push @Modules,'MFPAddressConnect'; ## MFP Address Connect API

#push @Modules,'numticket';			## [New] 順番待ち受付システム
#push @Modules,'spreadsheet';		## [New] Googleスプレッドシート連携CGI版
#push @Modules,'questionnaire2';	## [New] アンケート集計モジュール2
#push @Modules,'qrcode';	## [New] QRコード添付
#push @Modules,'estimate';	## [New] 見積リスト
#push @Modules,'veritrans';	## [New] veritrans決済
#push @Modules,'hostblock';	## [New] ホスト名チェック
#push @Modules,'yamato';	## [New] クロネコWEBコレクト決済
#push @Modules,'ticket';	## [New] 座席予約システム
#push @Modules,'pricecheck'; ## [New 4.3.2] 価格チェック機能

####################################################
## 高度な設定的な感じのもの
####################################################

## 詳細なsendmail設定
#$config{'sendmail_advanced'} = '/usr/local/bin/sendmail -t -f$email';

## 同一name属性の場合のセパレーター
$config{'multiple'} = "\n";

## 表示調整 単一行表示
$config{'singleline'} = "[ %s ] %s\n";

## 表示調整 複数行表示
$config{'multiline'} = "[ %s ]\n%s\n\n";

## 未入力の項目を含める(1: on / 0: off)
$config{'blankfield'} = 0;

## 連続送信対応
$config{'seek'} = 0;

## SSL環境下でのみCookie使う場合有効にしてください
#$config{'secure'} = ' secure; HttpOnly';

## メールの改行コード
#$config{'breakcode'} = "\r\n";

## 開封確認 (開封確認を通知する場合は以下の1行のコメントを解除)
#$config{'Notification'} = $mailto[0];

## 各種データを格納しているファイル

$config{'data.dir'} = './data/';

## [0] Serial, [1] InputTime, [2] ConfirmTime, [3] UniqueUser
$config{'file.data'} = "$config{'data.dir'}dat.mailformpro.cgi";

## カウンタファイル
$config{'file.count'} = "$config{'data.dir'}dat.counter.cgi";

## ドロップ検知
$config{'file.drop'} = "$config{'data.dir'}dat.drop.cgi";

## jsキャッシュ
$config{'file.cache'} = "$config{'data.dir'}mfp.cache.js";

## 言語設定ファイル
$config{'lang'} = 'lang.ja';
#$config{'lang'} = 'lang.en';

## プロトコル
$config{'protocol'} = 'http://';
if($ENV{'HTTPS'}){
	$config{'protocol'} = 'https://';
}

## スクリプトのURL / ※基本的にここは変更しなくてOKです
$config{'uri'} = $config{'protocol'} . $ENV{'SERVER_NAME'} . $ENV{'SCRIPT_NAME'};

## Prefix
$config{'prefix'} = '_MFP';

1;