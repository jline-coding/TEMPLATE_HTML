## 以下のURLよりAPIキーを取得してください
## https://platform.deepseek.com/
## ※Deepseek APIの利用は有料です

## DeepseekのAPIキー
$config{"Deepseek.APIKey"} = "sk-*******************************";

## Deepseekの使用model
$config{"Deepseek.model"} = "deepseek-chat";

## APIのエンドポイント
$config{"Deepseek.endpoint"} = "https://api.deepseek.com/chat/completions";

## Deepseekに送信するプロンプト
$_TEXT{'Deepseek.prompt'} = <<"__HTML__";
以下の文章をとても簡潔に100文字以内で要約してください。
返すのは要約された本文のみで、説明・注意書き・記号・装飾・前置きなどは一切不要です。本文だけを返してください。
<_resbody_>
__HTML__

## 以下、言語設定
$lang{'Deepseek'} = 'Deepseek';

1;