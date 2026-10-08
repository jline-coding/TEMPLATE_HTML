%_C = ();
&_COOKIE;
&_POST;

$_{'APP'}->{'html'} = &_LOAD("./librarys/app.tpl");
$_{'APP'}->{'VAL'}->{'title'} = 'Calendar';
if(&_APP_SECURE()){
	if(-f "$config{'dir.calendar'}ready.cgi"){
		## セットアップ済み
		my($key,$password,$ip) = split(/\t/,&_LOAD("$config{'dir.calendar'}ready.cgi"));
		my @ip = split(/\,/,$ip);
		if($_GET{'key'} eq $key && ($ip eq $null || grep(/^$ENV{'REMOTE_ADDR'}$/,@ip) == 1)){
			if(&_APP_AUTH()){
				## ログイン済み
				## ログイン済みの場合、フロントページ
				## ログアウト処理 ## 共通化
				&_APP_CONTROLLER();
			}
			else {
				## ログイン画面表示 ## 共通化
				## 未ログイン
				## ログイン処理
				### IPアドレスチェック
				### 難読化キーチェック
				### ブルートフォースアタック対策 ## 共通化
				my @error = ();
				if($_POST{'mode'} eq 'login'){
					if(!$_POST{'password'}){
						push @error,"<li>パスワードが入力されていません</li>";
					}
					elsif(&_HASH($_POST{'password'}) eq $password){
						$_COOKIE{'appses'} = &_HASH(time() . $ENV{'REMOTE_ADDR'} . &_APP_PASSCODE(10));
						&_SAVE("$config{'data.dir'}/apps/auth/$_COOKIE{'appses'}.cgi",$null);
						$_{'APP'}->{'redirect'} = &_APP_URI();
					}
					else {
						&_APP_ERROR_COUNT(801,"パスワードが間違っています");
						push @error,"<li>ログインできませんでした</li>";
					}
				}
				my $error = "";
				if(@error > 0){
					$error = "<ul class=\"error\">" . join("",@error) . "</ul>";
				}
				my $uri = (lc(($ENV{SERVER_PROTOCOL}=~m|(\w*)/?|)[0])||"http")."://".$ENV{SERVER_NAME}.($ENV{SERVER_PORT}!=80?":".$ENV{SERVER_PORT}:"") . $ENV{SCRIPT_NAME} . '?module=' . $_GET{'module'} . '&type=' . $_GET{'type'} . '&key=' . $_GET{'key'};
				## セットアップ画面  ## 共通化
				$_{'APP'}->{'VAL'}->{'main'} = <<"				__HTML__";
					<section class="app app_inline">
						<h2><span>ログイン</span></h2>
						${error}
						<form method="POST">
							<input type="hidden" name="mode" value="login">
							<dl>
								<dt>パスワード</dt>
								<dd><input type="password" name="password" placeholder="パスワード"></dd>
							</dl>
							<button>ログイン</button>
							<dl>
								<dt>難読化された管理画面のURL</dt>
								<dd><input type="text" id="uri" readonly="readonly" value="${uri}" onfocus="this.select();"></dd>
							</dl>
						</form>
					</section>
				__HTML__
			}
		}
		else {
			&_APP_ERROR(801,"モジュールの実行に失敗しました");
		}
	}
	else {
		## 未セットアップ
		my @error = ();
		if($_POST{'mode'} eq 'setup'){
			## セットアップ情報受取
			## バリデーション
			if(!$_POST{'password'}){
				push @error,"<li>パスワードが入力されていません</li>";
			}
		}
		if(@error == 0 && $_POST{'mode'} eq 'setup'){
			## セットアップ情報に問題がない場合
			## 難読化URLの設定 ## 共通化
			## パスワードの設定と暗号化 ## 共通化
			my $key = &_HASH(time() . $ENV{'REMOTE_ADDR'});
			my $password = &_HASH($_POST{'password'});
			my $ip = "";
			if($_POST{'ip'} && $_POST{'ipadd'}){
				$ip = $_POST{'ipadd'};
			}
			if(!(-d $config{"dir.calendar"})){
				mkdir $config{"dir.calendar"};
			}
			my @data = ($key,$password,$ip);
			&_SAVE("$config{'dir.calendar'}ready.cgi",join("\t",@data));
			$_{'APP'}->{'redirect'} = &_APP_URI() . '&key=' . $key;
		}
		else {
			my $error = "";
			if(@error > 0){
				$error = "<ul class=\"error\">" . join("",@error) . "</ul>";
			}
			## セットアップ画面  ## 共通化
			$_{'APP'}->{'VAL'}->{'main'} = <<"			__HTML__";
				<section class="app app_inline">
					<h2><span>セットアップ</span></h2>
					${error}
					<form method="POST">
						<input type="hidden" name="mode" value="setup">
						<dl>
							<dt>パスワードの設定</dt>
							<dd><input type="password" name="password" placeholder="パスワード"></dd>
							<dt>IPアドレスによる接続制限</dt>
							<dd>
								<label><input type="checkbox" name="ip" value="1">管理機能へアクセスできるIPアドレスを制限する</label>
								<input type="text" name="ipadd" placeholder="" value="$ENV{'REMOTE_ADDR'}">
								<span>複数のIPアドレスを指定する場合はカンマ区切りで指定してください</span>
							</dd>
						</dl>
						<button>セットアップ</button>
					</form>
				</section>
			__HTML__
		}
		## 未セットアップで運用されている場合、メールに警告表示 ## 共通化
	}
}
else {
	&_APP_ERROR(999,"アクセスが制限されています");
}
&_APP_RESULT;
exit;
sub _CAL {
	my($year,$mon) = @_;
	$afterday = time;
	my($s,$min,$h,$d,$m,$y) = localtime(time + (60 * 60 * 24 * $config{"calendar.dayafter"}));
	my $active_date = sprintf("%04d-%02d-%02d",$y+1900,$m+1,$d);
	my $active_datetime = sprintf("%04d-%02d-%02d %02d:%02d",$y+1900,$m+1,$d,$h,$min);
	my(@calendar) = (0,31,28,31,30,31,30,31,31,30,31,30,31);
	my(@week) = ("日","月","火","水","木","金","土");
	my $html = "";
	my $flag = 0;
	if($year % 100 == 0 || $year % 4 != 0){
		if($year % 400 != 0){
			$flag = 0;
		}
		else{
			$flag = 1;
		}
	}
	elsif($year % 4 == 0){
		$flag = 1;
	}
	else{
		$flag = 0;
	}
	$calendar[2] += $flag;
	$today = &_WEEK($year,$mon,1);
	
	$html = "\n<!--putCalender-->\n";
	$html .= "<table class=\"calebdar\">\n";
	$html .= "\t<tr align=\"left\" valign=\"middle\">\n";
	$html .= "\t\t<form method=\"post\" action=\"?type=$_GET{'type'}&module=calendar&year=$_GET{'prev_year'}&month=$_GET{'prev_month'}\"><td colspan=\"2\" class=\"prev\">${pw}<button type=\"submit\">&lt; $_GET{'prev_year'}年$_GET{'prev_month'}月</button></td></form>\n";
	$html .= "\t\t<td colspan=\"3\"><strong>${year}年${mon}月</strong></td>\n";
	$html .= "\t\t<form method=\"post\" action=\"?type=$_GET{'type'}&module=calendar&year=$_GET{'next_year'}&month=$_GET{'next_month'}\"><td colspan=\"2\" class=\"next\">${pw}<button type=\"submit\">$_GET{'next_year'}年$_GET{'next_month'}月 &gt;</button></td></form>\n";
	$html .= "\t</tr>\n";
	$html .= "\t<form method=\"post\">${pw}\n";
	$html .= "\t<tr align=\"center\" valign=\"middle\">\n";
	for(my $cnt=0;$cnt<@week;$cnt++){
		$html .= "\t\t<th>${week[$cnt]}</th>\n";
	}
	$html .= "\t</tr>\n";
	$html .= "\t<tbody><tr align=\"center\" valign=\"middle\">\n";
	for(my $cnt=0;$cnt < $today;$cnt++){
		$html .= "\t\t<td class=\"blank\">&nbsp;</td>\n";
	}
	for(my $cnt=1;$cnt <= $calendar[$mon];$cnt++){
		my $name = sprintf("%04d-%02d-%02d",$year,$mon,$cnt);
		if($active_date gt $name){
			$html .= "\t\t<td class=\"blank\">\n";
			$html .= "\t\t<span class=\"day\">${cnt}</span>\n";
			$html .= "\t\t</td>\n";
		}
		else {
			$html .= "\t\t<td>\n";
			$html .= "\t\t<span class=\"day\">${cnt}</span>\n";
			for(my $i=0;$i<@item;$i++){
				$html .= "<div><h3>${item[$i]}</h3><input type=\"hidden\" name=\"date\" value=\"${name}\">";
				my $id = "${name}\t${item[$i]}\t";
				my ($id,$item,$qty,$price,$className) = split(/\t/,(grep(/^${id}/,@calendardata))[0]);
				my $complate = " complate";
				if($item eq $null){
					$complate = " incomplate";
					$qty = $config{"calendar.qty"};
					$price = $config{"calendar.price"};
				}
				$html .= " <input type=\"text\" class=\"qty qty${today}${complate}\" name=\"${name}_${item[$i]}_qty\" value=\"${qty}\">";
				$html .= " <em><font>&yen;</font><input type=\"text\" class=\"price price${today}${complate}\" name=\"${name}_${item[$i]}_price\" value=\"${price}\"></em>";
				$html .= " <input type=\"text\" class=\"className className${today}${complate}\" name=\"${name}_${item[$i]}_className\" value=\"${className}\" placeholder=\"className\">";
				$html .= "</div>";
			}
			$html .= "\t\t</td>\n";
		}
		if($today == 6){
			$html .= "\t</tr>\n";
			if($cnt < $calendar[$mon]){$html .= "\t<tr align=\"center\" valign=\"middle\">\n";}
			$today = 0;
		}
		else{
			$today++;
		}
	}
	while($today <= 6 && $today != 0){
		$html .= "\t\t<td class=\"blank\">&nbsp;</td>\n";
		if($today == 6){
			$html .= "\t</tr>\n";
		}
		$today++;
	}
	$html .= "\t\t</tbody>\t\t<tr><th colspan=\"7\" style=\"text-align: center;\"><input type=\"hidden\" name=\"method\" value=\"save\" /><button type=\"submit\">更新</button></th></tr>\n";
	$html .= "</form>";
	$html .= "</table>";
	return $html;
}
sub _WEEK {
	my($year,$month,$day) = @_;
	if ($month == 1 || $month == 2) {
		$year--;
		$month += 12;
	}
	return int($year + int($year/4) - int($year/100) + int($year/400) + int((13*$month+8)/5) + $day) % 7;
}
1;