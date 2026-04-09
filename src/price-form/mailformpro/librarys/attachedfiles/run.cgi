if($config{"att_file_log"}){
	$logdir = $config{"dir.att_file_log_dir"};
	if($config{"att_file_log_dir"}){
		mkdir "$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}";
		$logdir = "$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}/";
	}
	for(my $cnt=0;$cnt<@att_file_names;$cnt++){
		if(-f $att_file_names[$cnt]){
			$_FILE_SAVE_NAME{$attach_file_element[$cnt]} = "$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}";
			rename $att_file_names[$cnt],"${logdir}$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}";
		}
	}
}

## Dropbox
if($config{'att_file_dropbox_app_key'} ne $null && $config{'att_file_dropbox_app_secret'} ne $null && $config{'att_file_dropbox_access_token'} ne $null && @att_file_names > 0){
	my $hash = &_HASH(time . "." . $ENV{'REMOTE_ADDR'});
	my @dropbox_files = ();
	for(my $cnt=0;$cnt<@att_file_names;$cnt++){
		if(-f "${att_file_names[$cnt]}"){
			$size = -s "${att_file_names[$cnt]}";
			if($size < $config{'att_file_dropbox_limit'}){
				push @dropbox_filenames,"/$_ENV{'mfp_serial'}/${att_file_names_origin[$cnt]}";
				push @dropbox_files,"/${att_file_names[$cnt]}";
			}
		}
		elsif(-f "$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}"){
			$size = -s "$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}";
			if($size < $config{'att_file_dropbox_limit'}){
				push @dropbox_filenames,"/$_ENV{'mfp_serial'}/${att_file_names_origin[$cnt]}";
				push @dropbox_files,"/$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}";
			}
		}
		elsif(-f "$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}/$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}"){
			$size = -s "$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}/$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}";
			if($size < $config{'att_file_dropbox_limit'}){
				push @dropbox_filenames,"/$_ENV{'mfp_serial'}/${att_file_names_origin[$cnt]}";
				push @dropbox_files,"/$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}/$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}";
			}
		}
	}
	if(@dropbox_files > 0){
		$dropboxPHP = "\$UploadFiles = array\('" . join("','",@dropbox_files) . "'\);\n";
		$dropboxPHP .= "\$UploadFileNames = array\('" . join("','",@dropbox_filenames) . "'\);\n";
		$dropboxPHP .= "\$AppKey = \'$config{'att_file_dropbox_app_key'}\';\n";
		$dropboxPHP .= "\$SecretKey = \'$config{'att_file_dropbox_app_secret'}\';\n";
		$dropboxPHP .= "\$AccessToken = \'$config{'att_file_dropbox_access_token'}\';\n";
		$dropboxPHP .= "\$thanks_url = \'$config{'ThanksPage'}\';\n";
		if($config{"att_file_log"}){
			$dropboxPHP .= "\$file_clear = false;\n";
		}
		else {
			$dropboxPHP .= "\$file_clear = true;\n";
		}
		&_SAVE("$config{'data.dir'}temp/${hash}.php","<?php\n${dropboxPHP}?>");
		$_RESULT{'uri'} = "dropbox.php?key=${hash}";
	}
}
1;