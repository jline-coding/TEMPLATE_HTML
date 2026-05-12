mfp.extend.event('ready',
	function(){
		if(window.localStorage){
			if(window.localStorage['mfp_landing_referrer']){
				var e = document.createElement('input');
				e.type = 'hidden';
				e.name = 'mfp_landing_referrer';
				e.value = decodeURIComponent(window.localStorage['mfp_landing_referrer']);
				mfp.$('mailformpro').appendChild(e);
			};
		};
	}
);
