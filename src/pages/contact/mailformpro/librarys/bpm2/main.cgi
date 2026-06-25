&_GET;
if(-f "$config{'bpm.Token.dir'}$_GET{'token'}.cgi"){
	my $currentTime = time;
	if($currentTime < ((stat("$config{'bpm.Token.dir'}$_GET{'token'}.cgi"))[9]+$config{'bpm.expire'})){
		$config{'buffer'} = &_LOAD("$config{'bpm.Token.dir'}$_GET{'token'}.cgi");
		if($config{'buffer'} =~ /^(.*?)\n\[\[(.*?)\]\]/si){
			$_ENV{'mfp_serial'} = $1;
			$config{'buffer'} = $2;
			&_POST;
			if($_GET{'cancel'}){
				print "Location: $config{'bpm.CancelPage'}\n\n";
				unlink "$config{'bpm.Token.dir'}$_GET{'token'}.cgi";
				my $subject = "\[ $_ENV{'mfp_serial'} \] 決済がキャンセルされました";
				my $body = "受付番号 $_ENV{'mfp_serial'} の決済がキャンセルされました";
				for(my $i=0;$i<@mailto;$i++){
					&_SENDMAIL($mailto[$i],$config{'bpm.NoticeFrom'},$config{'bpm.NoticeFrom'},$subject,$body);
				}
			}
			elsif($_GET{'method'} eq 'callback' && $_GET{'tran_code'} ne $null && $_GET{'amount'} ne $null){
				$config{'ThanksPage'} = sprintf($config{'ThanksPage'},$_ENV{'mfp_serial'});
				print "Location: $config{'ThanksPage'}\n\n";
				unlink "$config{'bpm.Token.dir'}$_GET{'token'}.cgi";
				my $subject = "\[ $_ENV{'mfp_serial'} \] 決済が完了しました";
				my $body = "受付番号 $_ENV{'mfp_serial'} の決済が完了しました\n決済承認番号：$_GET{'tran_code'}\n決済金額：$_GET{'amount'} $_GET{'currency_code'}";
				for(my $i=0;$i<@mailto;$i++){
					&_SENDMAIL($mailto[$i],$config{'bpm.NoticeFrom'},$config{'bpm.NoticeFrom'},$subject,$body);
				}
			}
			else {
				my @items = split(/\|\|/,$_ENV{'mfp_cart'});
				my $itemName = "";
				my $itemQty = 0;
				my $itemPrice = 0;
				my $itemOther = 0;
				for(my $i=0;$i<@items;$i++){
					my($name,$id,$price,$qty) = split(/<->/,$items[$i]);
					$itemQty += $qty;
					$itemPrice += ($price * $qty);
					if(!$itemName){
						$itemName = $name;
					}
					else {
						$itemOther = 1;
					}
				}
				my @html = ("<form method=\"post\" id=\"bpm\" action=\"https://payment.bpmc.jp/link/$config{'bpm.API_TOKEN'}/payment\">");
				push @html,"<img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARcAAABHCAIAAACiSJTAAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6Q0RFMkQyRTUyODg0MTFFNjlBMEU5MEY2NEREQkQ5RjQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6Q0RFMkQyRTYyODg0MTFFNjlBMEU5MEY2NEREQkQ5RjQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpDREUyRDJFMzI4ODQxMUU2OUEwRTkwRjY0RERCRDlGNCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpDREUyRDJFNDI4ODQxMUU2OUEwRTkwRjY0RERCRDlGNCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PsEdcc8AABXuSURBVHja7J37U1ZV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\">";
				if($itemOther){
					push @html,"<input type=\"hidden\" name=\"product\" value=\"${itemName}など${itemQty}点の商品\">";
				}
				else {
					push @html,"<input type=\"hidden\" name=\"product\" value=\"${itemName}\">";
				}
				my $uri = &_MFP2URI("module=bpm2&token=$_GET{'token'}");
				push @html,"<input type=\"hidden\" name=\"amount\" value=\"${itemPrice}\">";
				push @html,"<input type=\"hidden\" name=\"currency_code\" value=\"JPY\">";
				push @html,"<input type=\"hidden\" name=\"shop_tracking\" value=\"$_ENV{'mfp_serial'}\">";
				push @html,"<input type=\"hidden\" name=\"callback_url\" value=\"${uri}&method=callback\">";
				push @html,"<input type=\"hidden\" name=\"cancel_url\" value=\"${uri}&method=callback&cancel=1\">";
				if($_POST{'email'}){
					push @html,"<input type=\"hidden\" name=\"email\" value=\"$_POST{'email'}\">";
				}
				if($_POST{$config{'bpm.PhoneName'}}){
					my $tel = $_POST{$config{'bpm.PhoneName'}};
					$tel =~ s/ー//ig;
					$tel =~ s/－//ig;
					$tel =~ s/-//ig;
					$tel =~ s/\(//ig;
					$tel =~ s/\)//ig;
					push @html,"<input type=\"hidden\" name=\"tel\" value=\"${tel}\">";
				}
				push @html,"<input type=\"hidden\" name=\"shop_data1\" value=\"\">";
				push @html,"<input type=\"hidden\" name=\"shop_data2\" value=\"\">";
				push @html,"<input type=\"hidden\" name=\"shop_data3\" value=\"\">";
				push @html,"<button>決済画面に進む</button>";
				push @html,"</form>";
				my $parts = join("\n",@html);
				my $html = &_LOAD("./librarys/bpm2/template.tpl");
				$html =~ s/_%%main%%_/$parts/ig;
				print "Pragma: no-cache\n";
				print "Cache-Control: no-cache\n";
				print "Content-type: text/html; charset=UTF-8\n\n";
				print $html;
			}
		}
		else {
			unlink "$config{'bpm.Token.dir'}$_GET{'token'}.cgi";
			&_Error(1);
		}
	}
	else {
		unlink "$config{'bpm.Token.dir'}$_GET{'token'}.cgi";
		&_Error(2);
	}
}
else {
	&_Error(3);
}
1;