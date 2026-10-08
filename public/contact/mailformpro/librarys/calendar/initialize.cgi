unshift @_ENV,'calendar.manager';
$_ENV{'calendar.manager'} = $config{'uri'} . "?module=calendar";
1;