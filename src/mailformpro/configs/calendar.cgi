## カレンダーデータディレクトリ
$config{"dir.calendar"} = "$config{'data.dir'}";

## 予約データファイル
$config{"file.calendar"} = "$config{'dir.calendar'}calendar.cgi";

## 何日後から表示するか
$config{"calendar.dayafter"} = 1;

## 予約アイテムID（カンマ区切り）
$config{"calendar.item"} = ["ROOM1","ROOM2","ROOM3"];

## 在庫基準値
$config{"calendar.qty"} = [15,10,15];

## 価格基準値 （価格を設定しない場合は0）
$config{"calendar.price"} = [9800,10800,11800];

## 予約状況管理パスワード
$config{"calendar.password"} = 'GQMJ2955tkic';

## ホスト名による管理を制限する場合は以下に指定してください。
#$config{'calendar.HostName'} = 'localhost';

## IPアドレスによる管理を制限する場合は以下に指定してください。
#$config{'calendar.IPAddress'} = '127.0.0.1';

## 在庫未設定時の挙動
## 在庫未設定の場合、在庫を自動セットする
$config{"calendar.auto.stock"} = 1;

## 在庫未設定の場合の予約可能開始日（X時間後から／翌日からの場合は24）
$config{"calendar.auto.min"} = 48;

## 在庫未設定の場合の予約可能日数（当日からX日分まで）
$config{"calendar.auto.max"} = 90;

## 在庫未設定の場合の価格
$config{"calendar.auto.price"} = [9800,10800,11800];

## 在庫未設定時の予約可能曜日（1は予約可能、0は予約不可）
$config{"calendar.auto.w0"} = 0; ## 日曜日
$config{"calendar.auto.w1"} = 1; ## 月曜日
$config{"calendar.auto.w2"} = 1; ## 火曜日
$config{"calendar.auto.w3"} = 1; ## 水曜日
$config{"calendar.auto.w4"} = 1; ## 木曜日
$config{"calendar.auto.w5"} = 1; ## 金曜日
$config{"calendar.auto.w6"} = 0; ## 土曜日

## 以下、言語設定
$lang{'calendar.manager'} = '予約状況管理';

1;