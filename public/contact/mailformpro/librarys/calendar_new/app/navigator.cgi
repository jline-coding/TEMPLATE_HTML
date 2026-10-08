$_{'APP'}->{'VAL'}->{'navigator'} = <<"__HTML__";
	<nav>
		<div>
			<span id="navigator">&#8801;</span>
			<ul>
				<li><a href="_%%this%%_">ダッシュボード</a></li>
				<li><a href="_%%this%%_function=calendar">カレンダー管理</a></li>
				<li><a href="_%%this%%_function=type">区分管理</a></li>
				<li><a href="_%%this%%_function=stock">在庫管理</a></li>
				<li><a href="_%%this%%_function=config">設定</a></li>
				<li><a href="$_{'APP'}->{'VAL'}->{'logouthref'}">ログアウト</a></li>
			</ul>
		</div>
	</nav>
__HTML__
1;