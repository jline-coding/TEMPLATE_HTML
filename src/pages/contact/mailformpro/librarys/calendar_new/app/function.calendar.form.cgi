if($_POST{'name'}){
	my @db = &_DB("$config{'dir.calendar'}calendar.cgi");
	my $id;
	if($_POST{'id'}){
		$id = $_POST{'id'};
		@db = grep(!/^${id}\t/,@db);
	}
	else {
		$id = &_APP_ID("$config{'dir.calendar'}calendar.id.cgi");
	}
	my @data = ($id,$_POST{'name'},$_POST{'type'});
	push @db,join("\t",@data);
	&_SAVE("$config{'dir.calendar'}calendar.cgi",join("\n",@db));
	$_{'APP'}->{'redirect'} = &_APP_URI() . "&function=calendar#stat2";
}
else {
	#my ($day,$stock,$price) = split(/\t/,&_LOAD("$config{'dir.calendar'}config.cgi"));
	my %edit = ();
	$edit{'label'} = '追加';
	if($_GET{'id'}){
		my @r = &_APP_RECORD("$config{'dir.calendar'}calendar.cgi",$_GET{'id'});
		$edit{'id'} = "<input type=\"hidden\" name=\"id\" value=\"${r[0]}\">";
		$edit{'name'} = $r[1];
		$edit{'label'} = '更新';
	}
	$_{'APP'}->{'VAL'}->{'main'} = <<"	__HTML__";
		<section class="app app_wide">
			<h2><span>カレンダーの$edit{'label'}</span></h2>
			<form method="POST">
				$edit{'id'}
				<dl>
					<dt>カレンダー名</dt>
					<dd><input type="text" name="name" value="$edit{'name'}"></dd>
					<dt>対応区分</dt>
					<dd>${type}</dd>
				</dl>
				<button>カレンダーを$edit{'label'}</button>
				_%%return%%_
			</form>
		</section>
	__HTML__
}
1;