mfpLang['WarningCode'][10] = 'CAPTCHA認証に失敗しました。';
function mfp_reCAPTCHACallback(data){
	mfp.$('g-recaptcha-response').value = data;
	mfp.$('reCAPTCHA').disabled = true;
	mfp.$('submitButton').disabled = false;
	//mfp.$('errormsg_'+mfp.$('reCAPTCHA').name).style.display = 'none';
}