if($config{"att_file_log"} && $config{'att_file_donwloader'}){
	my $logdir = $config{"dir.att_file_log_dir"};
	if($config{"att_file_log_dir"}){
		$logdir = "$config{'dir.att_file_log_dir'}$_ENV{'mfp_serial'}/";
	}
	my(@att_files_path) = ();
	$_ENV{'att_file_downloader_uris'} = "";
	$lang{'att_file_downloader_uris'} = 'ファイルダウンロード';
	
	for(my $cnt=0;$cnt<@att_file_names;$cnt++){
		if(-f $att_file_names[$cnt]){
			my $name = &encodeURI($att_file_names_origin[$cnt]);
			$_POST{"att_filename_${cnt}"} = "$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}";
			$amp = '?';
			if(index($_POST{'mfp_script'},'?') > -1){
				$amp = '&';
			}
			$_ENV{'att_file_downloader_uris'} .= "${att_file_names_origin[$cnt]}\n<$_POST{'mfp_script'}${amp}module=attachedfiles&key=$config{'att_file_donwloader'}&path=${logdir}$_ENV{'mfp_serial'}_${cnt}\.${att_file_types[$cnt]}&name=${name}>\n";
		}
	}
}
1;