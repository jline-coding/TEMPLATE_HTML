if($_POST{'day'} ne $null || $_POST{'stock'} ne $null || $_POST{'price'} ne $null){
	my @data = ($_POST{'day'},$_POST{'stock'},$_POST{'price'});
	&_SAVE("$config{'dir.calendar'}config.cgi",join("\t",@data));
	$_{'APP'}->{'redirect'} = &_APP_URI() . "&function=config#stat1";
}
else {
	my ($day,$stock,$price) = split(/\t/,&_LOAD("$config{'dir.calendar'}config.cgi"));
	$_{'APP'}->{'VAL'}->{'main'} = <<"	__HTML__";
		<section class="app app_inline">
			<h2><span>設定</span></h2>
			<form method="POST">
				<dl>
					<dt>何日後から表示するか</dt>
					<dd><input type="number" name="day" value="${day}"></dd>
					<dt>在庫基準値</dt>
					<dd><input type="number" name="stock" value="${stock}"></dd>
					<dt>価格基準値 （価格を設定しない場合は0）</dt>
					<dd><input type="number" name="price" value="${price}"></dd>
				</dl>
				<button>更新</button>
				_%%return%%_
			</form>
		</section>
	__HTML__
}
1;