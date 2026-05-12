window.onpageshow = function(e) {
	if (e.persisted) {
		location.reload();
	 };
};