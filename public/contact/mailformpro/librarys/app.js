var web = {
	App: [],
	Val: [],
	Env: [],
	GET: [],
	Extend: [],
	OG: [],
	json: function(src){
		var script = document.createElement('script');
		script.async = false;
		script.type = 'text/javascript';
		script.src = src;
		script.charset = 'UTF-8';
		script.onerror = function(){
			web.json(src);
		};
		document.body.appendChild(script);
	},
	add: function(event,fn){
		var _ = web;
		if(!_.Extend[event]){
			_.Extend[event] = [];
		};
		_.Extend[event].push(fn);
	},
	get: function(){
		if(location.search){
			var g = (location.search.substring(1,location.search.length)).split('&');
			for(var i=0;i<g.length;i++){
				var get = [];
				get = g[i].split('=');
				web.GET[decodeURI(get[0])] = decodeURI(get[1]);
			};
		};
	},
	run: function(event){
		var _ = web;
		if(_.Extend[event]){
			for(var i=0;i<_.Extend[event].length;i++){
				_.Extend[event][i]();
			};
		};
	},
	initialize: function(){
		var _ = web;
		_.get();
		_.addEvent(window,'load',function(){
			_.environment(1);
			_.addEvent(window,'scroll',function(){
				_.environment();
				web.run('scroll');
			});
			_.addEvent(window,'resize',function(){
				_.environment(1);
				web.run('resize');
			});
			_.addEvent(window,'gestureend',function(){
				_.environment(1);
				web.run('resize');
			});
			web.run('ready');
			web.run('resize');
		});
	},
	environment: function(resize){
		var _ = web;
		var bd = document.body,el = document.documentElement;
		if(resize){
			_.Env['canvas'] = {
				width: window.innerWidth || document.documentElement.clientWidth,
				height: window.innerHeight || document.documentElement.clientHeight
			};
			_.Env['contents'] = {
				width: el.scrollWidth || bd.scrollWidth,
				height: el.scrollHeight || bd.scrollHeight
			};
		};
		_.Env['scroll'] = {
			top: el.scrollTop || bd.scrollTop,
			left: el.scrollLeft || bd.scrollLeft
		};
		_.Env['scroll']['horizon'] = _.Env['scroll']['left'] / (_.Env['contents']['width']-_.Env['canvas']['width']);
		_.Env['scroll']['vertical'] = _.Env['scroll']['top'] / (_.Env['contents']['height']-_.Env['canvas']['height']);
	},
	$: function(obj){
		if(typeof obj == 'string'){
			if(document.getElementById(obj)){
				return document.getElementById(obj);
			}
			else {
				return null;
			};
		}
		else {
			return obj;
		};
	},
	byClassName: function(parentNode,className){
		var _ = web;
		try {
			return parentNode.getElementsByClassName(className);
		}
		catch(e){
			var classNames = [];
			var elements = parentNode.getElementsByTagName('*');
			for(var i=0;i<elements.length;i++){
				if(_.className(elements[i],className)){
					classNames.push(elements[i]);
				};
			};
			return classNames;
		};
	},
	className: function(obj,name,reg){
		var _ = web;
		var classNames = new Array();
		classNames = obj.className.split(' ');
		if(!reg){
			var className = new Object();
			for(var i=0;i<classNames.length;i++){
				className[classNames[i]] = true;
			};
			if(name){
				return className[name];
			}
			else {
				return className;
			};
		}
		else {
			var className = null;
			for(var i=0;i<classNames.length;i++){
				if(classNames[i].match(reg)){
					return classNames[i];
				};
			};
			return className;
		};
	},
	addClassName: function(obj,name){
		var _ = web;
		if(!_.className(obj,name)){
			obj.className += ' '+name;
		};
	},
	removeClassName: function(obj,name){
		var _ = web;
		var classNames = [];
		classNames = obj.className.split(' ');
		var setClassName = [];
		for(var i=0;i<classNames.length;i++){
			if(classNames[i] != name)
				setClassName.push(classNames[i]);
		};
		obj.className = setClassName.join(' ');
	},
	addEvent: function(elm,listener,fn){
		try {
			elm.addEventListener(listener,fn,false);
		}
		catch(e){
			elm.attachEvent('on'+listener,fn);
		};
	},
	ready: function(fn){
		if(document.addEventListener){
			document.addEventListener("DOMContentLoaded",fn,false);
		}
		else {
			var IEReady = function(){
				try {
					document.documentElement.doScroll("left");
				}
				catch(e) {
					setTimeout(IEReady,1);
					return;
				};
				fn();
			};
			IEReady();
		};
	}
};
web.App.stat = {
	initialize: function(){
		var hashKey = location.hash.substring(1,location.hash.length);
		var div = document.createElement('div');
		div.id = 'stat';
		var text = "";
		switch(hashKey){
			case 'stat1':
				text = '更新しました';
				break;
			case 'stat2':
				text = '追加しました';
				break;
			case 'stat3':
				text = '削除しました';
				break;
		};
		if(text){
			div.innerHTML = text;
			document.body.appendChild(div);
			setTimeout(function(){
				web.$('stat').style.bottom = '20px';
				setTimeout(function(){
					web.$('stat').style.bottom = '-60px';
				},2000);
			},100);
		};
	}
};
web.App.navigator = {
	stat: false,
	initialize: function(){
		if(web.$('navigator')){
			web.$('navigator').onclick = function(){
				if(web.App.navigator.stat){
					web.$('navigator').parentNode.parentNode.className = '';
					web.App.navigator.stat = false;
				}
				else {
					web.$('navigator').parentNode.parentNode.className = 'open';
					web.App.navigator.stat = true;
				};
			};
		};
	}
};
web.App.button = {
	initialize: function(){
		var button = web.byClassName(document.body,'app_link_button');
		for(var i=0;i<button.length;i++){
			button[i].type = 'button';
			button[i].onclick = function(){
				if(this.getAttribute('data-confirm')){
					if(confirm(this.getAttribute('data-confirm'))){
						location.href = this.getAttribute('data-href');
					};
				}
				else {
					location.href = this.getAttribute('data-href');
				};
			};
		};
	}
};

web.add('ready',function(){
	web.App.navigator.initialize();
	web.App.stat.initialize();
	web.App.button.initialize();
});