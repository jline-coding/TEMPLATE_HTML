if($_GET{'id'}){
	my @db = &_DB("$config{'dir.calendar'}calendar.cgi");
	@db = grep(!/^$_GET{'id'}\t/,@db);
	&_SAVE("$config{'dir.calendar'}calendar.cgi",join("\n",@db));
}
$_{'APP'}->{'redirect'} = &_APP_URI() . "&function=calendar#stat3";
1;