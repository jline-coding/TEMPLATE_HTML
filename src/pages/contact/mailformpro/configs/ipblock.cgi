## 連続送信を計測する秒数
$config{'ipblock.time'} = 3600;

## 上記時間内にX回の送信があった場合にブロックを発動
$config{'ipblock.qty'} = 3;

## IPアドレスを記録するディレクトリ
$config{"ipblock.dir"} = "$config{'data.dir'}ipblock/";

## エラーメッセージ
$lang{'ErrorCode11'} = 'ご利用のIPアドレスは現在送信が制限されています。<br>時間をおいてから再度ご送信ください。<br>Sending currently is restricted for your IP address. Please try again later.';

1;