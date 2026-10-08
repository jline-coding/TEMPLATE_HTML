
## 決済方法
$config{'bpm.PaymentType'} = '決済方法';
$config{'bpm.PaymentName'} = 'クレジット決済';
$config{'bpm.ShopId'} = '************'; ## ShopId
$config{'bpm.Job'} = 'CAPTURE';
$config{'bpm.Item'} = 'オンライン販売商品';
$config{'bpm.ShopCode'} = ''; ## mfp_serial
$config{'bpm.CardName.elementName'} = 'カード名義';
$config{'bpm.CardNumber.elementName'} = 'カード番号';
$config{'bpm.CardYear.elementName'} = 'カード有効期限（年）';
$config{'bpm.CardMonth.elementName'} = 'カード有効期限（月）';
$config{'bpm.CardCVV.elementName'} = 'セキュリティコード';
$config{'bpm.Phone.elementName'} = '電話番号';
$config{'bpm.Email.elementName'} = 'email';
$config{'bpm.ItemType'} = 0;

## ホスト名の検証をしない場合、以下のコメント欄を解除してください
# $ENV{'PERL_LWP_SSL_VERIFY_HOSTNAME'} = 0;

1;