var mfpStock = {
	qty: [],
	id: [''],
	values: [''],
	change: function(){
		mfpStock.call();
	},
	call: function(){
		mfpStock.values = [''];
		for(var i=1;i<mfpStock.id.length;i++){
			var selectedIndex = mfp.$(mfpStock.id[i]).selectedIndex;
			console.log(selectedIndex);
			var value = "";
			if(selectedIndex > -1){
				value = mfp.$(mfpStock.id[i]).options[selectedIndex].value;
			};
			mfpStock.values.push(value);
		};
		var uri = mfp.uri("addon=stock/stock.js&id=" + encodeURIComponent(mfpStock.id.join(',')) + "&value=" + encodeURIComponent(mfpStock.values.join(',')));
		mfp.json(uri);
	},
	callback: function(json){
		console.log(json);
		for(var i=1;i<mfpStock.id.length;i++){
			mfp.$(mfpStock.id[i]).length = json.elements[i-1].length + 1;
			mfp.$(mfpStock.id[i]).options[0].text = json.label[i];
			mfp.$(mfpStock.id[i]).options[0].value = "";
			for(var ii=0;ii<json.elements[i-1].length;ii++){
				mfp.$(mfpStock.id[i]).options[ii+1].text = json.elements[i-1][ii].text;
				mfp.$(mfpStock.id[i]).options[ii+1].value = json.elements[i-1][ii].text;
				//mfp.$(mfpStock.id[i]).options[ii+1].disabled = json.elements[i-1][ii].disabled;
				if(mfpStock.values[i] == json.elements[i-1][ii]){
					mfp.$(mfpStock.id[i]).options[ii+1].selected = true;
				};
			};
		};
	},
	error: function(){
		console.log("ERROR");
	}
};
mfp.extend.event('ready',
	function(){
		mfpStock.call();
	}
);

mfp.extend.event('init',
	function(obj){
		if(obj.getAttribute('data-stock-id')){
			var num = Number(obj.getAttribute('data-stock-id'));
			mfpStock.id[num] = obj.id;
		}
		else if(obj.getAttribute('data-stock-qty')){
			mfpStock.qty.push(obj.name);
		};
	}
);
mfp.extend.event('change',
	function(obj){
		if(obj.getAttribute('data-stock-id')){
			mfpStock.change();
		};
	}
);
