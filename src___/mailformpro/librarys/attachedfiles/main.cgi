&_GET;

if($config{"att_file_donwloader"} ne $null && $config{"att_file_donwloader"} eq $_GET{'key'}){
	my $HostName = &_GETHOST;
	my $type = (split(/\./,$_GET{"path"}))[-1];
	$type = lc $type;
	if(($config{'att_file_DownloadHostName'} eq $HostName || $config{'att_file_DownloadHostName'} eq $null) && ($config{'att_file_DownloadIPAddress'} eq $ENV{'REMOTE_ADDR'} || $config{'att_file_DownloadIPAddress'} eq $null) && grep(/^${type}$/,@att_filetype) == 1 && $_GET{"path"} =~ /^$config{'dir.att_file_log_dir'}.*?${type}$/si){
		if(-f $_GET{"path"}){
			$size = -s $_GET{"path"};
			print "Content-type: application/octet-stream; charset=UTF-8; name=\"$_GET{'name'}\"\n";
			print "Content-Disposition: attachment; filename=\"$_GET{'name'}\"\n";
			print "Content-length: ${size}\n\n";
			open(IN,$_GET{"path"});
				binmode(IN);
				print <IN>;
			close(IN);
		}
		else {
			&_Error(0);
		}
	}
	else {
		&_Error(0);
	}
}
exit;