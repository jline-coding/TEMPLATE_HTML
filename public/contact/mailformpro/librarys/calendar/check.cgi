sub getWeek {
	my ($y, $m, $d) = @_;
	if ($m < 3) {
		$m += 12;
		$y -= 1;
	}
	return ($d + int((13 * ($m + 1)) / 5) + $y + int($y / 4) - int($y / 100) + int($y / 400)) % 7;
}

## mfp_calendar_date 
## mfp_calendar_id
my @calendardata = &_DB($config{"file.calendar"});
if($_POST{'mfp_calendar_date'} && $_POST{'mfp_calendar_id'}){
	if(!$_POST{'mfp_calendar_qty'}){
		$_POST{'mfp_calendar_qty'} = 1;
	}
	my $item = $_POST{'mfp_calendar_id'};
	my $date = $_POST{'mfp_calendar_date'};
	my $id = "${date}\t${item}\t";
	my($date,$item,$qty,$price,$className) = split(/\t/,(grep(/^${id}/,@calendardata))[0]);
	if($date eq $_POST{'mfp_calendar_date'} && $item eq $_POST{'mfp_calendar_id'} && $qty >= $_POST{'mfp_calendar_qty'}){
		## 在庫がある
	}
	elsif($config{"calendar.auto.stock"}){
		## 自動在庫設定時の挙動
		my ($y,$m,$d) = split(/\-/,$_POST{'mfp_calendar_date'});
		my $w = &getWeek($y,$m,$d);
		my @item = @{$config{"calendar.item"}};
		my $basicStock = 0;
		my $basicPrice = 0;
		for(my $i=0;$i<@item;$i++){
			if($_POST{'mfp_calendar_id'} eq $item[$i]){
				$basicStock = $config{"calendar.qty"}[$i];
				$basicPrice = $config{"calendar.auto.price"}[$i];
			}
		}
		if($basicStock >= $_POST{'mfp_calendar_qty'} && $config{"calendar.auto.w${w}"} == 1){
			## 自動在庫設定の予約範囲内
		}
		else {
			## エラーメッセージ
			$_ErrorScreen = 1;
			$Error = 'ReserveError';
			$lang{'WarningReserveError'} = '予約できませんでした';
		}
	}
	else {
		## エラーメッセージ
		$_ErrorScreen = 1;
		$Error = 'ReserveError';
		$lang{'WarningReserveError'} = '予約できませんでした';
	}
}
1;