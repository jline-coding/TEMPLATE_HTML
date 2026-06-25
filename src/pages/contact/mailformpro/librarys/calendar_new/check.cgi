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
		
	}
	else {
		## エラーメッセージ
		$_ErrorScreen = 1;
		$Error = 'ReserveError';
		$lang{'WarningReserveError'} = '予約できませんでした';
	}
}
1;