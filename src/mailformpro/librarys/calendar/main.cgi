&_POST;
$html = &_LOAD("./librarys/calendar/template.tpl");
my($sec,$min,$hour,$day,$mon,$year) = localtime(time);
if(!$_GET{'year'}){
	$_GET{'year'} = $year + 1900;
	$_GET{'month'} = $mon + 1;
}
$_GET{'prev_year'} = $_GET{'year'};
$_GET{'prev_month'} = $_GET{'month'} - 1;
if($_GET{'prev_month'} < 1){
	$_GET{'prev_year'}--;
	$_GET{'prev_month'} = 12;
}
$_GET{'next_year'} = $_GET{'year'};
$_GET{'next_month'} = $_GET{'month'} + 1;
if($_GET{'next_month'} > 12){
	$_GET{'next_year'}++;
	$_GET{'next_month'} = 1;
}

#my @item = split(/\,/,$config{"calendar.item"});
my @item = @{$config{"calendar.item"}};
my %price = ();
for(my $i=0;$i<@item;$i++){
	$price{$item[$i]} = $config{"calendar.price"}[$i];
}
my @calendardata = &_DB($config{"file.calendar"});

if($config{"calendar.password"} ne $null && $config{"calendar.password"} eq $_POST{'password'}){
	$HostName = &_GETHOST;
	if(($config{'calendar.HostName'} eq $HostName || $config{'calendar.HostName'} eq $null) && ($config{'calendar.IPAddress'} eq $ENV{'REMOTE_ADDR'} || $config{'calendar.IPAddress'} eq $null)){
		$pw = "<input type=\"hidden\" name=\"password\" value=\"$_POST{'password'}\" />";
		if($_POST{'method'} eq 'save'){
			$save = "<div id=\"stat\">Save Complate</div>";
			my @date = split(/\n/,$_POST{'date'});
			for(my $cnt=0;$cnt<@date;$cnt++){
				for(my $i=0;$i<@item;$i++){
					my $id = "${date[$cnt]}\t${item[$i]}\t";
					@calendardata = grep(!/^${id}/,@calendardata);
					my @day = ($date[$cnt],$item[$i],$_POST{"${date[$cnt]}_${item[$i]}_qty"},$_POST{"${date[$cnt]}_${item[$i]}_price"},$_POST{"${date[$cnt]}_${item[$i]}_className"});
					if( (!($day[2] =~ /[^0-9]/si) || $day[2] eq '-') && !($day[3] =~ /[^0-9]/si)){
						push @calendardata,join("\t",@day);
					}
				}
			}
			my($s,$min,$h,$d,$m,$y) = localtime(time + (60 * 60 * 24 * $config{"calendar.dayafter"}));
			my $active_date = sprintf("%04d-%02d-%02d",$y+1900,$m+1,$d);
			for(my $cnt=0;$cnt<@calendardata;$cnt++){
				@r = split(/\t/,$calendardata[$cnt]);
				if($r[0] ge $active_date){
					push @savedata,$calendardata[$cnt];
				}
			}
			@savedata = sort { (split(/\t/,$a))[0] cmp (split(/\t/,$b))[0]} @savedata;
			&_SAVE($config{"file.calendar"},join("\n",@savedata));
			@calendardata = @savedata;
		}
		## 一覧
		$calebdar = &_CAL($_GET{'year'},$_GET{'month'});
		my($parts) = <<"		__HTML__";
			<div id="wrapper">
				${save}
				${calebdar}
			</div>
		__HTML__
		$html =~ s/_%%content%%_/$parts/ig;
		print "Pragma: no-cache\n";
		print "Cache-Control: no-cache\n";
		print "Content-type: text/html; charset=UTF-8\n\n";
		print $html;
	}
	else {
		&_Error(0);
	}
}
else {
	if($config{"calendar.password"} ne $null){
		## Display Process
		$HostName = &_GETHOST;
		my $parts = <<"		__HTML__";
			<div id="wrapper">
			<table>
				<tr>
					<th>Host Name</th>
					<td>${HostName}</td>
					<th>IP Address</th>
					<td>$ENV{'REMOTE_ADDR'}</td>
				</tr>
			</table>
			<div id="stat"></div>
			<form method="POST">
				<h2>LOGIN</h2>
				<input type="password" name="password" /> <input type="submit" value="LOGIN" />
			</form>
			</div>
		__HTML__
		$html =~ s/_%%content%%_/$parts/ig;
		print "Pragma: no-cache\n";
		print "Cache-Control: no-cache\n";
		print "Content-type: text/html; charset=UTF-8\n\n";
		print $html;
	}
	else {
		&_Error(0);
	}
}
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
					$qty = $config{"calendar.qty"}[$i];
					$price = $config{"calendar.price"}[$i];
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