if($_GET{'id'} ne $null && -f $config{"file.calendar"}){
	my @calendar = &_DB($config{"file.calendar"});
	@calendar = grep(/\t$_GET{'id'}\t/,@calendar);
	my @json = ();
	my %dateCheck = ();
	for(my $i=0;$i<@calendar;$i++){
		my ($date,$id,$stock,$price,$className) = split(/\t/,$calendar[$i]);
		if($_ENV{'mfp_day'} le $date){
			$dateCheck{$date} = 1;
			if($stock =~ /[^0-9]/){
				$stock = "'-'";
			}
			my @j = ();
			if($price){
				push @j,"price\: ${price}";
			}
			if($className){
				push @j,"className\: \'${className}\'";
			}
			my $j = join("\,",@j);
			if($stock){
				push @json,"\'${date}\'\: \{stock\: ${stock},${j}\}";
			}
		}
	}
	if($config{"calendar.auto.stock"}){
		my @item = @{$config{"calendar.item"}};
		my $basicStock = 0;
		my $basicPrice = 0;
		for(my $i=0;$i<@item;$i++){
			if($_GET{'id'} eq $item[$i]){
				$basicStock = $config{"calendar.qty"}[$i];
				$basicPrice = $config{"calendar.auto.price"}[$i];
			}
		}
		my $time = time() + ($config{"calendar.auto.min"} * 3600);
		for(my $i=0;$i<$config{"calendar.auto.max"};$i++){
			my($sec,$min,$hour,$day,$mon,$year,$wday) = localtime($time);
			my $date = sprintf("%04d-%02d-%02d",$year+1900,$mon+1,$day);
			$time += (3600 * 24);
			if(!$dateCheck{$date} && $config{"calendar.auto.w${wday}"}){
				my @j = ();
				if($basicPrice){
					push @j,"price\: ${basicPrice}";
				}
				my $j = join("\,",@j);
				push @json,"\'${date}\'\: \{stock\: ${basicStock},${j}\}";
				$dateCheck{$date} = 1;
			}
		}
	}
	my $json = join("\,",@json);
	$js = "mfpCalendar.callback(\{${json}\});";
}
else {
	$js = 'mfpCalendar.error();';
}
1;