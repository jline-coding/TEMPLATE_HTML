if($_POST{'name'}){
	my $id = "";
	my @data = ($_POST{'day'},$_POST{'stock'},$_POST{'price'});
	&_SAVE("$config{'dir.calendar'}calendar.cgi",&_APP_DATA(\@data));
	$_{'APP'}->{'redirect'} = &_APP_URI() . "&function=calendar#stat2";
}
else {
	my %href = ();
	$href{"add"} = &_APP_URI() . "&function=calendar&action=form";
	$href{"edit"} = &_APP_URI() . "&function=calendar&action=form&id=";
	$href{"remove"} = &_APP_URI() . "&function=calendar&action=remove&id=";
	#my ($day,$stock,$price) = split(/\t/,&_LOAD("$config{'dir.calendar'}config.cgi"));
	my @db = &_DB("$config{'dir.calendar'}calendar.cgi");
	my @tbody = ();
	for(my $i=0;$i<@db;$i++){
		my @r = split(/\t/,$db[$i]);
		push @tbody,"<tr><th><a href=\"$href{'edit'}${r[0]}\">${r[1]}</a></th><td><button data-href=\"$href{'remove'}${r[0]}\" class=\"app_link_button\" data-confirm=\"削除してもよろしいですか？\">削除</button></td></tr>";
	}
	my $tbody = join("\n",@tbody);
	$_{'APP'}->{'VAL'}->{'main'} = <<"	__HTML__";
		<section class="app app_wide">
			<h2><span>カレンダーの管理</span></h2>
			<table class="app_list">
				<thead>
					<tr>
						<th colspan="2">カレンダー名</th>
					</tr>
				</thead>
				<tbody>
					${tbody}
				</tbody>
			</table>
			<form method="POST">
				<button data-href="$href{'add'}" class="app_link_button">カレンダーを追加</button>
				_%%return%%_
			</form>
		</section>
	__HTML__
}
1;