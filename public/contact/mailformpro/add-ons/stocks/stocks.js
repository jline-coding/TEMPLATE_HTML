//
// estimate.js 1.0.0 / 2020-08-23
//
var MfpStocks = {
	Objects: [],
	change: function(obj){
		if(obj.value != ""){
			var id = obj.getAttribute('data-id');
			var col = parseInt(obj.getAttribute('data-col')) + 1;
			var querys = new Array();
			for(var i=0;i<MfpStocks.Objects[id].query.length+1;i++){
				if(i < (col-6)){
					querys.push(MfpStocks.Objects[id].query[i]);
				}
				else {
					var childId = 'mfp_stocks_wrap_' + id + '_' + (i+6);
					if(mfp.$(childId)){
						mfp.$(childId).parentNode.removeChild(mfp.$(childId));
					};
				};
			};
			MfpStocks.Objects[id].query = querys;
			MfpStocks.Objects[id].query.push(obj.value);
			var query = MfpStocks.Objects[id].query.join("\t");
			mfp.call(mfp.$('mfpjs').src,'addon=stocks/stocks.js&callback=MfpStocks.callback&id='+id+'&item='+MfpStocks.Objects[id].file+'&col='+col+'&q='+encodeURIComponent(query));
		};
	},
	reset: function(id){
		var selectId = 'mfp_stocks_wrap_' + id + '_5_select';
		mfp.$(selectId).selectedIndex = 0;
		var col = 5;
		var querys = new Array();
		for(var i=0;i<MfpStocks.Objects[id].query.length+1;i++){
			if(i < (col-6)){
				querys.push(MfpStocks.Objects[id].query[i]);
			}
			else {
				var childId = 'mfp_stocks_wrap_' + id + '_' + (i+6);
				if(mfp.$(childId)){
					mfp.$(childId).parentNode.removeChild(mfp.$(childId));
				};
			};
		};
		MfpStocks.Objects[id].query = querys;
		MfpStocks.Objects[id].query.push("");
		if(mfp.$('mfp_stocks_wrapper_'+id)){
			var top = mfp.absolutePosition('mfp_stocks_list_'+id);
			mfp.smoothScroll(top-50,1000);
		};
	},
	callback: function(json){
		var wrap = document.createElement('div');
		wrap.id = 'mfp_stocks_wrap_' + json.id + '_' + json.column;
		wrap.className = 'mfp_stocks_wrap';
		var label = document.createElement('div');
		label.className = 'mfp_stocks_label';
		label.innerHTML = json.label;
		wrap.appendChild(label);
		
		var select = document.createElement('select');
		select.id = 'mfp_stocks_wrap_' + json.id + '_' + json.column + '_select';
		select.setAttribute('data-id',json.id);
		select.setAttribute('data-col',json.column);
		select.setAttribute('data-query',json.query);
		select.onchange = function(){
			MfpStocks.change(this);
		};
		var option = document.createElement('option');
		option.text = json.label;
		option.value = "";
		select.appendChild(option);
		for(var i=0;i<json.items.length;i++){
			var option = document.createElement('option');
			option.text = json.items[i];
			option.value = json.items[i];
			select.appendChild(option);
		};
		wrap.appendChild(select);
		wrap.style.opacity = 0;
		mfp.$('mfp_stocks_wrapper_' + json.id).appendChild(wrap);
		setTimeout(function(){
			mfp.$('mfp_stocks_wrap_' + json.id + '_' + json.column).style.opacity = '1';
		},100);
	},
	add: function(obj){
		var item = [];
		item.id = obj.getAttribute('data-id');
		item.name = obj.getAttribute('data-name');
		item.code = obj.getAttribute('data-code');
		item.image = obj.getAttribute('data-image');
		item.price = obj.getAttribute('data-price');
		item.status = obj.getAttribute('data-status');
		MfpStocks.Objects[item.id].cart.push(item);
		MfpStocks.rebuild(item.id);
		MfpStocks.reset(item.id);
	},
	rebuild: function(id){
		var parent = 'mfp_stocks_list_' + id;
		var list = parent + '_table';
		mfp.$(id).value = "";
		if(mfp.$(list)){
			mfp.$(list).parentNode.removeChild(mfp.$(list));
		};
		if(MfpStocks.Objects[id].cart.length > 0){
			var values = [];
			var table = document.createElement('table');
			table.id = list;
			table.className = 'mfp_stocks_list_table';
			(function(){
				var thead = document.createElement('thead');
				var tr = document.createElement('tr');
				(function(){
					var th = document.createElement('th');
					th.innerHTML = '商品名';
					th.colSpan = '2';
					tr.appendChild(th);
				})();
				(function(){
					var th = document.createElement('th');
					th.innerHTML = '価格';
					tr.appendChild(th);
				})();
				(function(){
					var th = document.createElement('th');
					th.innerHTML = '取消';
					tr.appendChild(th);
				})();
				thead.appendChild(tr);
				table.appendChild(thead);
			})();
			var total = 0;
			var tbody = document.createElement('tbody');
			for(var i=0;i<MfpStocks.Objects[id].cart.length;i++){
				var obj = MfpStocks.Objects[id].cart[i];
				var tr = document.createElement('tr');
				(function(){
					var td = document.createElement('td');
					if(obj.image){
						var img = document.createElement('img');
						img.src = "images/" + obj.image;
						td.appendChild(img);
					}
					else {
						td.innerHTML = '&nbsp;';
					};
					tr.appendChild(td);
				})();
				(function(){
					var th = document.createElement('th');
					th.innerHTML = obj.name;
					var span = document.createElement('span');
					span.innerHTML = obj.code + ':' + obj.status;
					th.appendChild(span);
					tr.appendChild(th);
				})();
				(function(){
					var td = document.createElement('td');
					td.innerHTML = '&yen;' + mfp.cm(obj.price);
					tr.appendChild(td);
					total += parseInt(obj.price);
				})();
				(function(){
					var td = document.createElement('td');
					var button= document.createElement('button');
					button.innerHTML = '&times;';
					button.setAttribute('data-id',id);
					button.setAttribute('data-num',i);
					button.onclick = function(){
						MfpStocks.remove(this);
					};
					td.appendChild(button);
					tr.appendChild(td);
				})();
				
				tbody.appendChild(tr);
				mfp.addcart(obj.name+'('+obj.status+')',obj.code,obj.price,1);
				values.push(obj.code + ' : ' + obj.name+'('+obj.status+') / '+mfp.cm(obj.price)+'円');
			};
			mfp.$(id).value = values.join("\n");
			table.appendChild(tbody);
			var tfoot = document.createElement('tfoot');
			(function(){
				var tr = document.createElement('tr');
				(function(){
					var td = document.createElement('td');
					td.innerHTML = '&nbsp;';
					td.colSpan = '2';
					tr.appendChild(td);
				})();
				(function(){
					var th = document.createElement('th');
					th.innerHTML = '&yen;'+mfp.cm(total);
					tr.appendChild(th);
				})();
				(function(){
					var td = document.createElement('td');
					td.innerHTML = '&nbsp;';
					tr.appendChild(td);
				})();
				tfoot.appendChild(tr);
			})();
			table.appendChild(tfoot);
			mfp.$(parent).appendChild(table);
			MfpStocks.Objects[id].price = total;
		}
		else {
			MfpStocks.Objects[id].price = 0;
		};
		mfp.calc();
	},
	remove: function(obj){
		var cart = [];
		var id = obj.getAttribute('data-id');
		var num = obj.getAttribute('data-num');
		for(var i=0;i<MfpStocks.Objects[id].cart.length;i++){
			if(i != num){
				cart.push(MfpStocks.Objects[id].cart[i]);
			};
		};
		MfpStocks.Objects[id].cart = [];
		for(var i=0;i<cart.length;i++){
			MfpStocks.Objects[id].cart.push(cart[i]);
		};
		MfpStocks.rebuild(id);
		mfp.calc();
	},
	finish: function(json){
		var id = json.id;
		var wrap = document.createElement('div');
		var button = document.createElement('button');
		wrap.id = 'mfp_stocks_wrap_' + json.id + '_' + (MfpStocks.Objects[id].query.length+5);
		wrap.className = 'mfp_stocks_wrap';
		var label = document.createElement('div');
		label.className = 'mfp_stocks_label';
		label.innerHTML = json.name + ' / ' + json.code;
		button.setAttribute('data-id',json.id);
		button.setAttribute('data-name',json.name);
		button.setAttribute('data-code',json.code);
		button.setAttribute('data-status',MfpStocks.Objects[id].query.join('/'));
		wrap.appendChild(label);
		if(json.image){
			var image = document.createElement('img');
			image.src = "images/" + json.image;
			wrap.appendChild(image);
			button.setAttribute('data-image',json.image);
		};
		var strong = document.createElement('strong');
		strong.innerHTML = '&yen;<em>' + mfp.cm(json.price) + '</em>'
		button.setAttribute('data-price',json.price);
		wrap.appendChild(strong);
		if(mfp.$(json.id).type == 'textarea'){
			button.innerHTML = 'リストに追加';
			button.className = 'mfp_stocks_button';
			button.onclick = function(){
				MfpStocks.add(this);
			};
			wrap.appendChild(button);
		};
		wrap.style.opacity = 0;
		mfp.$('mfp_stocks_wrapper_' + json.id).appendChild(wrap);
		setTimeout(function(){
			mfp.$('mfp_stocks_wrap_' + json.id + '_' + (MfpStocks.Objects[id].query.length+5)).style.opacity = '1';
		},100);
	},
	error: function(code){
		console.log('Error Code ' + code);
	}
};
mfp.extend.event('calc',
	function(){
		for(var prop in MfpStocks.Objects){
			if(MfpStocks.Objects[prop].price){
				mfp.Price += MfpStocks.Objects[prop].price;
			};
		};
	}
);
mfp.extend.event('init',
	function(obj){
		if(obj.getAttribute('data-stocks')){
			MfpStocks.Objects[obj.id] = [];
			MfpStocks.Objects[obj.id].cart = [];
			MfpStocks.Objects[obj.id].price = 0;
			MfpStocks.Objects[obj.id].file = obj.getAttribute('data-stocks');
			MfpStocks.Objects[obj.id].query = [];
			var list = document.createElement('div');
			list.className = 'mfp_stocks_list';
			list.id = 'mfp_stocks_list_' + obj.id;
			obj.parentNode.insertBefore(list,obj);
			
			var wrap = document.createElement('div');
			wrap.className = 'mfp_stocks_wrapper';
			wrap.id = 'mfp_stocks_wrapper_' + obj.id;
			obj.parentNode.insertBefore(wrap,obj);
			obj.style.display = 'none';
		};
	}
);
mfp.extend.event('ready',
	function(){
		for(var prop in MfpStocks.Objects){
			mfp.call(mfp.$('mfpjs').src,'addon=stocks/stocks.js&callback=MfpStocks.callback&id='+prop+'&item='+MfpStocks.Objects[prop].file);
		};
	}
);