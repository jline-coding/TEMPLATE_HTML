if($_POST{$config{'bpm.PaymentType'}} eq $config{'bpm.PaymentName'}){
	my($Serial,$InputTime,$ConfirmTime,$UniqueUser) = split(/\,/,&_LOAD($config{'file.data'}));
	my $orderno += $config{'SerialBoost'};
	$orderno = sprintf($config{'SerialFormat'},$Serial+1);
	$orderno =~ s/<date>/$dateStr/ig;

	use LWP::UserAgent;
	use HTTP::Request::Common qw(POST);
	%_BPM = ();
	$_BPM{'ShopId'} = $config{'bpm.ShopId'};
	$_BPM{'Job'} = $config{'bpm.Job'};
	$_BPM{'Item'} = $config{'bpm.Item'};
	$_BPM{'ShopCode'} = $orderno;
	$_BPM{'CardName'} = $_POST{$config{'bpm.CardName.elementName'}};
	$_BPM{'CardNumber'} = $_BPM_CARD{'CardNumber'};
	$_BPM{'CardYear'} = $_BPM_CARD{'CardYear'};
	$_BPM{'CardMonth'} = $_BPM_CARD{'CardMonth'};
	$_BPM{'CardCVV'} = $_BPM_CARD{'CardCVV'};
	$_BPM{'Phone'} = $_POST{$config{'bpm.Phone.elementName'}};
	$_BPM{'Email'} = $_POST{$config{'bpm.Email.elementName'}};
	$_BPM{'ItemType'} = $config{'bpm.ItemType'};
	$_BPM{'Amount'} = $_POST{'mfp_cartprice'};
	
	$_BPM{'CardName'} =~ s/　/ /ig;
	$_BPM{'CardName'} = uc $_BPM{'CardName'};
	$_BPM{'Phone'} =~ s/-//ig;
	my $uri = 'https://credit.bpmc.jp/gateway/v1/payment.php';
	my $request = POST( $uri, [%_BPM] );
	my $ua = LWP::UserAgent->new;
	my $res = $ua->request($request);
	if($res->code eq '200'){
		my $html = $res->content;
		$html =~ s/\n//ig;
		if($html =~ /\"Result\":0/sig){
			$Error = 15;
		}
		else {
			$_BPM{'result'} = 1;
		}
	}
	else {
		$Error = 15;
	}
}
1;