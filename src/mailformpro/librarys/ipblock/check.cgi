my %ipblock = ();
$ipblock{'path'} = "$config{'ipblock.dir'}$ENV{'REMOTE_ADDR'}\.cgi";
if(-f $ipblock{'path'}){
	$ipblock{'time'} = (stat($ipblock{'path'}))[9] + $config{'ipblock.time'};
	if(time > $ipblock{'time'}){
		unlink $ipblock{'path'};
	}
	else {
		my $count = -s $ipblock{'path'};
		if(time < $ipblock{'time'} && $count > $config{'ipblock.qty'}){
			$_ErrorScreen = 1;
			$Error = 'IPBlock';
		}
	}
}
&_APP_COUNTUP($ipblock{'path'});
1;