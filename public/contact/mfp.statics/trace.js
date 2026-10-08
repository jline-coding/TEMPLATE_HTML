if(document.referrer.indexOf(document.domain) == -1){
	if(window.localStorage){
		window.localStorage['mfp_landing_referrer'] = encodeURIComponent(document.referrer);
	};
};