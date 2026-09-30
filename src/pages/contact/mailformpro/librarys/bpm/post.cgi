$_BPM_CARD{'CardNumber'} = $_POST{$config{'bpm.CardNumber.elementName'}};
$_BPM_CARD{'CardCVV'} = $_POST{$config{'bpm.CardCVV.elementName'}};
$_BPM_CARD{'CardMonth'} = $_POST{$config{'bpm.CardMonth.elementName'}};
$_BPM_CARD{'CardYear'} = $_POST{$config{'bpm.CardYear.elementName'}};

my $len = length $_POST{$config{'bpm.CardNumber.elementName'}};
my $s = $len - 4;
my $n = substr($_POST{$config{'bpm.CardNumber.elementName'}},$s,$len);
my $t = "";
for(my $i=0;$i<$s;$i++){
	$t .= '*';
}
$_POST{$config{'bpm.CardNumber.elementName'}} = "${t}${n}";
$_POST{$config{'bpm.CardCVV.elementName'}} = '***';
$_POST{$config{'bpm.CardMonth.elementName'}} = "";
$_POST{$config{'bpm.CardYear.elementName'}} = "";
1;