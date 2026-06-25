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
		@calendardata = grep(!/^${id}/,@calendardata);
		$qty -= $_POST{'mfp_calendar_qty'};
		if($qty < 0){
			$qty = 0;
		}
		my @day = ($date,$item,$qty,$price,$className);
		push @calendardata,join("\t",@day);
		@calendardata = sort { (split(/\t/,$a))[0] cmp (split(/\t/,$b))[0]} @calendardata;
		&_SAVE($config{"file.calendar"},join("\n",@calendardata));
	}
}
1;