## mfp_calendar_date 
## mfp_calendar_id

sub getWeek {
	my ($y, $m, $d) = @_;
	if ($m < 3) {
		$m += 12;
		$y -= 1;
	}
	return ($d + int((13 * ($m + 1)) / 5) + $y + int($y / 4) - int($y / 100) + int($y / 400)) % 7;
}

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
	elsif($config{"calendar.auto.stock"}){
		## ©“®İŒÉİ’è‚Ì‹““®
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
			## ©“®İŒÉİ’è‚Ì—\–ñ”ÍˆÍ“à
			my $qty = $basicStock - $_POST{'mfp_calendar_qty'};
			my @day = ($_POST{'mfp_calendar_date'},$_POST{'mfp_calendar_id'},$qty,$basicPrice,$className);
			push @calendardata,join("\t",@day);
			@calendardata = sort { (split(/\t/,$a))[0] cmp (split(/\t/,$b))[0]} @calendardata;
			&_SAVE($config{"file.calendar"},join("\n",@calendardata));
		}
		else {
			
		}
	}
}
1;