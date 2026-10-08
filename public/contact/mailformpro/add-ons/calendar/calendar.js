var mfpCalendar = {
	ready: false,
	id: [],
	qtyObjects: [],
	calendarPath: null,
	json: [],
	position: 0,
	stat: 0,
	tax: 0,
	current: null,
	name: null,
	choice: {
		path: null,
		date: null,
		price: 0,
		stock: 0
	},
	day: [0,31,28,31,30,31,30,31,31,30,31,30,31],
	weekName: ["日","月","火","水","木","金","土"],
	weekClassName: ["sun","mon","tue","wed","thu","fri","sat"],
	monthName: ['','1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
	date: function(y,m,d){
		if(m < 10){
			m = "0"+m;
		};
		if(d < 10){
			d = "0"+d;
		};
		return y + "-" + m + "-" + d;
	},
	path: function(){
		var path = null;
		for(var i=0;i<mfpCalendar.id.length;i++){
			var obj = mfp.$(mfpCalendar.id[i]);
			if(obj.type == 'select-one'){
				var choice = obj.options[obj.selectedIndex].getAttribute('data-calendar-choice');
				if(choice){
					path = choice;
				};
				mfpCalendar.stat = obj.options[obj.selectedIndex].getAttribute('data-calendar-stat') || 10;
				mfpCalendar.tax = obj.options[obj.selectedIndex].getAttribute('data-tax') || 10;
				mfpCalendar.name = obj.options[obj.selectedIndex].getAttribute('data-calendar-name') || obj.options[obj.selectedIndex].text;
			}
			else if(obj.type == 'radio' && obj.checked){
				var choice = obj.getAttribute('data-calendar-choice');
				if(choice){
					path = choice;
				};
				mfpCalendar.stat = obj.getAttribute('data-calendar-stat') || 10;
				mfpCalendar.tax = obj.getAttribute('data-tax') || 10;
				mfpCalendar.name = obj.getAttribute('data-calendar-name') || obj.value;
			}
			else if(obj.type == 'hidden'){
				var choice = obj.getAttribute('data-calendar-choice');
				if(choice){
					path = choice;
				};
				mfpCalendar.stat = obj.getAttribute('data-calendar-stat') || 10;
				mfpCalendar.tax = obj.getAttribute('data-tax') || 10;
				mfpCalendar.name = obj.getAttribute('data-calendar-name') || obj.value;
			};
		};
		mfpCalendar.calendarPath = path;
		return path;
	},
	num: function(value){
		var num = Number(value);
		if(!isNaN(num) || value){
			return num;
		}
		else if(obj.value){
			return 1;
		}
		else {
			return 0;
		};
	},
	price: function(){
		var totalPrice = 0;
		var totalQty = 0;
		if(mfp.$('mfp_calendar_date').value){
			for(var i=0;i<mfpCalendar.qtyObjects.length;i++){
				var obj = mfp.$(mfpCalendar.qtyObjects[i]);
				if(!obj.disabled){
					var price = obj.getAttribute('data-calendar-price') || mfpCalendar.choice.price;
					var addprice = obj.getAttribute('data-calendar-addprice');
					if(obj.type == 'select-one' || obj.type == 'text' || obj.type == 'number'){
						var qty = mfpCalendar.num(obj.value);
						totalQty += qty;
						if(addprice){
							totalPrice += (mfpCalendar.choice.price + Number(addprice)) * qty;
						}
						else {
							totalPrice += Number(price) * qty;
						};
					}
					else if(obj.type == 'radio' && obj.checked){
						var qty = mfpCalendar.num(obj.value);
						totalQty += qty;
						if(addprice){
							totalPrice += (mfpCalendar.choice.price + Number(addprice)) * qty;
						}
						else {
							totalPrice += Number(price) * qty;
						};
					};
				};
			};
			if(!totalPrice){
				totalPrice = mfpCalendar.choice.price;
			};
		};
		mfp.$('mfp_calendar_qty').value = totalQty;
		if(mfpCalendar.choice.stock < totalQty){
			// stock error
			for(var i=0;i<mfpCalendar.qtyObjects.length;i++){
				var obj = mfp.$(mfpCalendar.qtyObjects[i]);
				obj.setAttribute('data-error','1');
				obj.setAttribute('data-error-text',mfp.$('mfp_calendar_wrapper').getAttribute('data-calendar-error'));
				mfp.check(obj);
			};
		}
		else {
			for(var i=0;i<mfpCalendar.qtyObjects.length;i++){
				var obj = mfp.$(mfpCalendar.qtyObjects[i]);
				obj.removeAttribute('data-error');
				obj.removeAttribute('data-error-text');
				mfp.check(obj);
			};
		};
		return totalPrice;
	},
	remove: function(){
		if(mfp.$('mfp_calendar_inner')){
			mfp.$('mfp_calendar_inner').parentNode.removeChild(mfp.$('mfp_calendar_inner'));
		};
	},
	move: function(m){
		mfpCalendar.position += m;
		if(mfpCalendar.position < 0){
			mfpCalendar.position = 0;
		};
		mfpCalendar.cal();
	},
	cal: function(){
		mfpCalendar.remove();
		var today = new Date();
		var y = today.getFullYear();
		var m = today.getMonth()+1;
		for(var i=0;i<mfpCalendar.position;i++){
			m++;
			if(m > 12){
				m = 1;
				y++;
			};
		};
		var currentMonth = new Date(y+'/'+m+'/1 00:00:00');
		var maxDay = mfpCalendar.day[m];
		var week = currentMonth.getDay();
		if(m == 2){
			if(y % 100 == 0 || y % 4 != 0){
				if(y % 400 == 0){
					maxDay++;
				};
			}
			else if(year % 4 == 0) {
				maxDay++;
			};
		};
		var inner = document.createElement('div');
		inner.id = 'mfp_calendar_inner';
		var table = document.createElement('table');
		table.id = 'mfp_calendar_table';
		// thead
		var thead = document.createElement('thead');
		(function(){
			var tr = document.createElement('tr');
			(function(){
				var th = document.createElement('th');
				th.className = 'mfp_calendar_ui_prev';
				th.onclick = function(){
					mfpCalendar.move(-1);
				};
				th.innerHTML = '<div>&lt;</div>';
				tr.appendChild(th);
			})();
			(function(){
				var th = document.createElement('th');
				th.colSpan = 5;
				th.className = 'mfp_calendar_ui_title';
				th.innerHTML = y + ' / ' + mfpCalendar.monthName[m];
				tr.appendChild(th);
			})();
			(function(){
				var th = document.createElement('th');
				th.className = 'mfp_calendar_ui_next';
				th.onclick = function(){
					mfpCalendar.move(1);
				};
				th.innerHTML = '<div>&gt;</div>';
				tr.appendChild(th);
			})();
			thead.appendChild(tr);
		})();
		(function(){
			var tr = document.createElement('tr');
			for(var i=0;i<7;i++){
				var th = document.createElement('th');
				th.className = mfpCalendar.weekClassName[i];
				th.innerHTML = mfpCalendar.weekName[i];
				tr.appendChild(th);
			};
			thead.appendChild(tr);
		})();
		table.appendChild(thead);
		var tbody = document.createElement('tbody');
		var tr = document.createElement('tr');
		for(var i=0;i<week;i++){
			var td = document.createElement('td');
			td.className = mfpCalendar.weekClassName[i];
			td.innerHTML = '&nbsp;';
			tr.appendChild(td);
		};
		for(var i=1;i<=maxDay;i++){
			var td = document.createElement('td');
			var className = [];
			className.push(mfpCalendar.weekClassName[week]);
			var id = mfpCalendar.date(y,m,i);
			var div = document.createElement('div');
			
			var span = document.createElement('span');
			span.className = 'day';
			span.innerHTML = i;
			div.appendChild(span);
			var price = document.createElement('span');
			price.className = 'mfp_calendar_price';
			
			if(mfpCalendar.json[id] != undefined){
				// stock
				var stat = document.createElement('span');
				var event = true;
				if(mfpCalendar.json[id].stock == 0){
					stat.className = 'mfp_calendar_stat_3';
					event = false;
				}
				else if(mfpCalendar.json[id].stock <= mfpCalendar.stat){
					stat.className = 'mfp_calendar_stat_2';
				}
				else {
					stat.className = 'mfp_calendar_stat_1';
				};
				if(mfpCalendar.json[id].className){
					className.push(mfpCalendar.json[id].className);
				};
				if(event){
					className.push('mfp_calendar_event');
					var tid = id.replace(/\//ig,'-');
					td.setAttribute('data-day',id);
					td.setAttribute('data-stock',mfpCalendar.json[id].stock);
					td.setAttribute('data-path',mfpCalendar.calendarPath);
					td.id = 'mfp_calendar_' + mfpCalendar.calendarPath + '-' + tid;
					if(mfpCalendar.json[id].price){
						price.innerHTML = '&yen;' + mfp.cm(mfpCalendar.json[id].price);
						td.setAttribute('data-price',mfpCalendar.json[id].price);
					};
					td.onclick = function(){
						mfpCalendar.set(this);
					};
					if(mfpCalendar.choice.path == mfpCalendar.calendarPath && mfpCalendar.choice.date == id){
						className.push('mfp_calendar_current');
					};
				};
				div.appendChild(stat);
				div.appendChild(price);
			}
			else {
				// ng stock
				var stat = document.createElement('span');
				stat.className = 'mfp_calendar_stat_0';
				div.appendChild(stat);
			};
			td.className = className.join(' ');
			td.appendChild(div);
			tr.appendChild(td);
			if(week == 6){
				tbody.appendChild(tr);
				tr = document.createElement('tr');
			};
			week++;
			week = week % 7;
		};
		while(week <= 6 && week != 0){
			var td = document.createElement('td');
			td.innerHTML = '&nbsp;';
			tr.appendChild(td);
			if(week == 6){
				tbody.appendChild(tr);
			};
			week++;
		};
		table.appendChild(tbody);
		
		inner.appendChild(table);
		mfp.$('mfp_calendar_wrapper').appendChild(inner);
	},
	set: function(obj){
		if(mfpCalendar.current){
			if(mfp.$(mfpCalendar.current)){
				mfp.removeClassName(mfp.$(mfpCalendar.current),'mfp_calendar_current');
			};
		};
		if(mfp.$('mfp_calendar_value')){
			mfp.$('mfp_calendar_value').value = mfpCalendar.name + ' : ' + obj.getAttribute('data-day');
		};
		if(mfp.$('mfp_calendar_id')){
			mfp.$('mfp_calendar_id').value = obj.getAttribute('data-path');
		};
		if(mfp.$('mfp_calendar_date')){
			mfp.$('mfp_calendar_date').value = obj.getAttribute('data-day');
		};
		if(obj.getAttribute('data-price')){
			mfpCalendar.choice.price = Number(obj.getAttribute('data-price'));
		}
		else {
			mfpCalendar.choice.price = 0;
		};
		mfpCalendar.choice.stock = Number(obj.getAttribute('data-stock'));
		mfpCalendar.choice.path = obj.getAttribute('data-path');
		mfpCalendar.choice.date = obj.getAttribute('data-day');
		mfp.addClassName(obj,'mfp_calendar_current');
		mfpCalendar.current = obj.id;
		mfp.calc();
	},
	call: function(){
		var path = mfpCalendar.path();
		mfpCalendar.remove();
		if(path){
			var uri = mfp.uri("addon=calendar/calendar.js&id=" + encodeURIComponent(path));
			mfp.json(uri);
		}
		else {
			if(mfp.$('mfp_calendar_wrapper')){
				var inner = document.createElement('div');
				inner.id = 'mfp_calendar_inner';
				var p = document.createElement('p');
				p.id = 'mfp_calendar_faild';
				p.innerHTML = mfp.$('mfp_calendar_wrapper').getAttribute('data-calendar-message');
				inner.appendChild(p);
				mfp.$('mfp_calendar_wrapper').appendChild(inner);
			};
		};
	},
	callback: function(json){
		mfpCalendar.json = json;
		mfpCalendar.cal();
	},
	error: function(){
		console.log("ERROR");
	}
};
mfp.extend.event('calc',
	function(){
		if(mfpCalendar.ready){
			var price = mfpCalendar.price()
			mfp.Price += price;
			if(mfpCalendar.tax){
				var tax = mfpCalendar.tax;
				if(!mfp.Tax[tax]){
					mfp.Tax[tax] = 0;
					mfp.NetPrice[tax] = 0;
					mfp.GrossPrice[tax] = 0;
				};
				mfp.Tax[tax] += price;
			};
		};
	}
);
mfp.extend.event('ready',
	function(){
		var ids = new Array('mfp_calendar_id','mfp_calendar_date','mfp_calendar_qty');
		for(var i=0;i<ids.length;i++){
			var e = document.createElement('input');
			e.type = 'hidden';
			e.name = ids[i];
			e.id = ids[i];
			mfp.$('mailformpro').appendChild(e);
		};
		mfpCalendar.call();
		mfpCalendar.ready = true;
	}
);
mfp.extend.event('change',
	function(obj){
		if(obj.getAttribute('data-calendar')){
			mfpCalendar.call();
		};
	}
);
mfp.extend.event('init',
	function(obj){
		if(obj.getAttribute('data-calendar')){
			mfpCalendar.id.push(obj.id);
		};
		if(obj.getAttribute('data-calendar-qty')){
			mfpCalendar.qtyObjects.push(obj.id);
		};
	}
);
