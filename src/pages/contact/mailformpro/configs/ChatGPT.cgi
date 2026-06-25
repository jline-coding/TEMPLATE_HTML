## 以下のURLよりAPIキーを取得してください
## https://platform.openai.com/api-keys
## ※ChatGPT APIの利用は有料です

## ChatGPTのAPIキー
$config{"ChatGPT.APIKey"} = "sk-proj-************************************************************************************************************************************************************";

## ChatGPTの使用model
$config{"ChatGPT.model"} = "gpt-4o";

## APIのエンドポイント
$config{"ChatGPT.endpoint"} = "https://api.openai.com/v1/chat/completions";

## ChatGPTに送信するプロンプト
$_TEXT{'ChatGPT.prompt'} = <<"__HTML__";
以下の文章をとても簡潔に100文字以内で要約してください。
返すのは要約された本文のみで、説明・注意書き・記号・装飾・前置きなどは一切不要です。本文だけを返してください。
<_resbody_>
__HTML__

## 以下、言語設定
$lang{'ChatGPT'} = 'ChatGPT';

1;