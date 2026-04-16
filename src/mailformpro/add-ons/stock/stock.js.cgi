if($_GET{'id'} ne $null){
	my @ids = split(/&#x2c;/,$_GET{'id'});
	my @values = split(/&#x2c;/,$_GET{'value'});
	my @selectedIndex = (0);
	my $db = &_LOAD("./configs/stock.txt.cgi");
	$db =~ s/\n/\t\n/ig;
	#my @db = &_DB("./configs/stock.txt.cgi");
	my @db = split(/\n/,$db);
	my $label = shift @db;
	my @match = @db;
	for(my $i=1;$i<@values;$i++){
		if($values[$i] ne $null){
			@match = grep(/\t${values[$i]}\t/,@match);
		}
	}
	my %conf = ();
	my @elements = ();
	my $maxCol = 0;
	my @label = split(/\t/,$label);
	## db をまわす
	for(my $i=0;$i<@db;$i++){
		my @r = split(/\t/,$db[$i]);
		## @match にマッチする場合
		## カラムをまわす
		for(my $ii=1;$ii<@r;$ii++){
			if($r[$ii] ne $null){
				if(!$conf{"${ii}_${r[$ii]}"}){
					my $disabled = 'false';
					if(grep(/\t${r[$ii]}\t/,@match) < 1){
						$disabled = true;
					}
					push @{$elm[$ii]},"\{text\:\'${r[$ii]}\',disabled\: ${disabled}\}";
					$conf{"${ii}_${r[$ii]}"} = 1;
					my $selectedIndex = @{$elm[$ii]};
					if($values[$ii] eq $r[$ii]){
						$selectedIndex[$ii] = $selectedIndex;
					}
				}
				if($maxCol < $ii){
					$maxCol = $ii;
				}
			}
		}
	}
	my @array = ();
	for(my $i=1;$i<=$maxCol;$i++){
		push @array,"\[" . join("\,",@{$elm[$i]}) . "\]";
	}
	my $selectedIndex = join(",",@selectedIndex);
	my $array = join("\,",@array);
	my $label = join("\'\,\'",@label);
	my $json = <<"	__HTML__";
	\{
		label\: \['${label}'\],
		elements\: \[
			${array}
		\]
	\}
	__HTML__
	$js = "mfpStock.callback(${json});";
}
else {
	$js = 'mfpStock.error();';
}
1;