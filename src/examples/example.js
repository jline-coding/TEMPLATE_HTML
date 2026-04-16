(function(){
	var exampleHTML = [];
	exampleHTML.push(
		{
			name: '基本機能',
			list: [
				{name: 'MailformPro 4.3.5 - 2026/01/03 基本サンプル',path: 'example.html'},
				{name: 'ゴチャゴチャなサンプル',path: 'sandbox.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '注意事項',
			list: [
				{name: 'ロリポップのサーバをご利用の方へ',path: 'lolipop.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.3.5からの新機能・アップデート',
			list: [
				{name: '[新機能] AI機能',path: 'ai.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.3.2からの新機能・アップデート',
			list: [
				{name: '[新機能] 予約カレンダー機能',path: 'calendar.html'},
				{name: '[新機能] 必須入力欄の背景色を変えるアドオン',path: 'requiredColor.html'},
				{name: '[新機能] 流入元URLの取得',path: 'trace.html'},
				{name: '[新機能] 戻ってきたら強制リロード',path: 'reload.html'},
				{name: '[新機能] 価格チェック機能',path: 'pricecheck.html'},
				{name: '[新機能] Discord通知機能',path: 'discord.html'},
				{name: '[アップデート] カートに入れるためのサンプル',path: 'shopping.html'},
				{name: '[アップデート] カート機能',path: 'cart.html'},
				{name: '[アップデート] 価格計算機能',path: 'calc.html'},
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.3.1からの新機能・アップデート',
			list: [
				{name: '座席予約システム',path: 'ticket.html'},
				{name: '日付選択リスト アップデート',path: 'date.html'},
			]
		}
	);
	
	exampleHTML.push(
		{
			name: '4.3.0からの新機能・アップデート',
			list: [
				{name: 'エクセルデータから見積機能',path: 'estimate.html'},
				{name: 'ベリトランス社の決済連携',path: 'veritrans.html'},
				{name: 'クロネコWEBコレクトの決済連携',path: 'yamato.html'},
				{name: 'ホスト名でブロックする機能',path: 'hostblock.html'},
				{name: '応答文章の分岐機能',path: 'response.html'},
				{name: '個数で乗算する機能',path: 'cart.html#update1'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.2.9からの新機能・アップデート',
			list: [
				{name: 'QRコード添付機能',path: 'qrcode.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.2.8からの新機能・アップデート',
			list: [
				{name: 'BPMクレジット決済リンク型',path: 'bpm2.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.2.7からの新機能・アップデート',
			list: [
				{name: '順番待ち受付機能',path: 'numticket.html'},
				{name: 'LINE通知機能',path: 'line_notify.html'},
				{name: 'Googleスプレッドシート連携CGI版',path: 'spreadsheet.html'},
				{name: 'ワンタイムトークン機能',path: 'onetimetoken.html'},
				{name: '年月選択補助機能',path: 'yearmonth.html'},
				{name: '集計機能2',path: 'counting.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.2.6からの新機能・アップデート',
			list: [
				{name: 'コール機能',path: 'call.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.2.5からの新機能・アップデート',
			list: [
				{name: 'サジェスト・サーチ機能',path: 'suggest.html'},
				{name: '注文個数の表示',path: 'cart.html'},
				{name: 'bootstrapへの対応',path: 'bootstrap.html'},
				{name: 'Sendgridへの対応',path: 'sendgrid.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.2.4からの新機能・アップデート',
			list: [
				{name: 'Paypalウェブペイメントプラス',path: 'paypalwebpaymentplus.html'},
				{name: '確認画面のカスタマイズ',path: 'confirm_window_customize.html'},
				{name: 'ガイド表示機能',path: 'guide.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '4.2.3からの新機能・アップデート',
			list: [
				{name: '生年月日入力補助機能',path: 'birthday.html'},
				{name: '入力内容の記憶機能',path: 'record.html'},
				{name: '確認用エレメント',path: 'confirm.html'},
				{name: 'リクエスト機能',path: 'request.html'},
				{name: 'クレジット決済機能(BPM社)',path: 'bpm.html'},
				{name: 'Googleスプレッドシート連携',path: 'google_spreadsheet.html'},
				{name: 'IPログ機能',path: 'iplogs.html'},
				{name: 'セパレータ設定サンプル',path: 'separator.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: 'カート関連機能',
			list: [
				{name: 'ショッピングカート機能サンプル',path: 'cart.html'},
				{name: 'カートに入れるためのサンプル',path: 'shopping.html'},
				{name: '料金計算機能サンプル',path: 'calc.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '予約関連機能',
			list: [
				{name: '予約機能サンプル',path: 'reserve.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '入力補助',
			list: [
				{name: '入力欄の分岐処理サンプル',path: 'toggle.html'},
				{name: '段階的入力機能サンプル',path: 'phase.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: 'ストレスチェック',
			list: [
				{name: 'ストレスチェック23項目サンプル',path: 'stress23.html'},
				{name: 'ストレスチェック57項目サンプル',path: 'stress57.html'}
			]
		}
	);
	exampleHTML.push(
		{
			name: '添付ファイル機能（有償）',
			list: [
				{name: '添付ファイル機能サンプル（有償）',path: 'attached.html'},
				{name: 'ドラッグ＆ドロップでファイル選択（有償）',path: 'attached_draganddrop.html'},
				{name: '添付ファイル機能サムネイル表示サンプル（有償）',path: 'attached_thumbnails.html'}
			]
		}
	);
	
	document.write('<div id="example_selector"><span>サンプルHTMLセレクター</span></div>');
	var select = document.createElement('select');
	select.onchange = function(){
		location.href = this.value;
	};
	var selectedIndex = 0;
	var index = 0;
	for(var i=0;i<exampleHTML.length;i++){
		var optgroup = document.createElement('optgroup');
		optgroup.label = exampleHTML[i].name;
		for(var ii=0;ii<exampleHTML[i].list.length;ii++){
			var dir = "";
			if(exampleHTML[i].list[ii].path != 'example.html' && exampleHTML[i].list[ii].path != 'index.en.html' && location.href.indexOf('examples') == -1){
				dir = "examples/";
			}
			else if(exampleHTML[i].list[ii].path == 'example.html' && location.href.indexOf('examples') > -1){
				dir = "../";
			}
			else if(exampleHTML[i].list[ii].path == 'index.en.html' && location.href.indexOf('examples') > -1){
				dir = "../";
			};
			var option = document.createElement('option');
			option.text = exampleHTML[i].list[ii].name + ' / ' + exampleHTML[i].list[ii].path;
			option.value = dir + exampleHTML[i].list[ii].path;
			optgroup.appendChild(option);
			if(location.href.indexOf(exampleHTML[i].list[ii].path) > -1){
				selectedIndex = index;
			};
			index++;
		};
		select.appendChild(optgroup);
	};
	select.selectedIndex = selectedIndex;
	document.getElementById('example_selector').appendChild(select);
})();