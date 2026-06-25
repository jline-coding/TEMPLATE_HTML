$config{'subject'} = $_TEXT{'subject'};
$config{'subject'} =~ s/\n//ig;
$config{'subject'} =~ s/\r//ig;
$config{'subject'} =~ s/\"//ig;
$config{'subject'} =~ s/\\//ig;

$config{'ReturnSubject'} = $_TEXT{'ReturnSubject'};
$config{'ReturnSubject'} =~ s/\n//ig;
$config{'ReturnSubject'} =~ s/\r//ig;
$config{'ReturnSubject'} =~ s/\"//ig;
$config{'ReturnSubject'} =~ s/\\//ig;

1;