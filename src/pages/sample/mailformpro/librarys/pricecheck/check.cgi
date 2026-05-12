if($_ENV{'mfp_cart'}){
	my @check = &_DB($config{"pricecheck.file"});
	my @cart = split(/\|\|/,$_ENV{'mfp_cart'});
	my $pricecheckError = 0;
	for(my $i=0;$i<@cart;$i++){
		my ($name,$id,$price,$qty) = split(/<->/,$cart[$i]);
		my ($cid,$cname,$cprice) = split(/\t/,(grep(/^${id}\t/,@check))[0]);
		if($cid ne $id || $cprice ne $price || $cname ne $name){
			$pricecheckError = 1;
		}
	}
	if($pricecheckError){
		$_ErrorScreen = 1;
		$Error = 'PriceCheck';
	}
}
1;