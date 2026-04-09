
sub _POST {
	use CGI;
	$file_counter = 0;
	$file_name_id = time();
	$file_attach_flag = 0;
	@attach_files = ();
	@attach_file_names = ();
	@attach_file_element = ();
	$attached_files_total_size = 0;
	my $q = new CGI;
	my @names = $q->param;
	for(my $cnt=0;$cnt<@names;$cnt++){
		my $name = $names[$cnt];
		if($name ne $null && $q->param($name) ne $null){
			if($q->upload($name)){
				@list = $q->param($name);
				push @ELEMENTS,$name;
				if(@list > 0){
					$value = join("\n",@list);
				}
				else {
					$value = $q->param($name);
				}
				$value =~ s/<br \/>/\n/ig;
				$value =~ s/<_.*?_>//g;
				&_CheckProcess($name,$value);
				$_POST{$name} = $value;
				@fH = $q->upload($name);
				$_FILE_QTY{$name} = @fH;
				for(my $i=0;$i<@fH;$i++){
					$fH = $fH[$i];
					$_FILE_NAME{"${name}_${i}"} = $fH;
					$value = $fH;
					@filenames = split(/\\/,$value);
					$filename = $filenames[-1];
					@filetypes = split /\./,$filename;
					$filetype = lc $filetypes[-1];
					$_FILE_TYPE{"${name}_${i}"} = $filetype;
					$save_file_name = "$config{'dir.temp'}${file_name_id}_${file_counter}";
					$binary = "";
					open (OUT, ">$save_file_name");
					binmode (OUT);
					while(read($fH, $buffer, 1024)){
						print OUT $buffer;
						$binary .= $buffer;
					}
					close (OUT);
					close ($fH) if ($CGI::OS ne 'UNIX');
					
					$file_counter++;
					$file_attach_flag = 1;
					$file_size = -s $save_file_name;
					$attached_files_total_size += $file_size;
					if($config{"mail_att_file_0_bytes_ng"} && $file_size == 0){
						$Error = 9;
						unlink $save_file_name;
					}
					elsif(1 == grep(/^${filetype}$/,@att_filetype) && $file_size < $config{'att_file_size_limit'}){
						if(!$config{"att_file_log"} && !$config{'att_file_dropbox_app_key'}){
							unlink $save_file_name;
						}
						else {
							push @att_file_names_origin,$filename;
							push @att_file_names,$save_file_name;
							push @att_file_types,$filetype;
							push @attach_file_element,"${name}_${i}";
						}
						if($config{"mail_att_file"} && (!$config{"mail_att_file_size_limit"} || $file_size < $config{"mail_att_file_size_limit"})){
							$fname = $value;
							if($filetype eq 'gif' || $filetype eq 'jpg' || $filetype eq 'png'){
								push @AttachedFiles,&_ATTACHEDIMAGE($fname,$binary);
							}
							else {
								push @AttachedFiles,&_ATTACHED($fname,$binary);
							}
						}
					}
					else {
						$Error = 8;
						unlink $save_file_name;
					}
				}
			}
			else {
				@list = $q->param($name);
				if(!$_ElementsList{$name}){
					$_ElementsList{$name} = 1;
					push @ELEMENTS,$name;
				}
				if(@list > 0){
					$value = join("\n",@list);
				}
				else {
					$value = $q->param($name);
				}
				$value =~ s/<br \/>/\n/ig;
				$value =~ s/<_.*?_>//g;
				&_CheckProcess($name,$value);
				$_POST{$name} = $value;
			}
		}
		elsif($config{'blankfield'} && !$_ElementsList{$name}){
			push @ELEMENTS,$name;
			$_ElementsList{$name} = 1;
		}
	}
	if($attached_files_total_size > $config{'att_file_size_total_limit'}){
		$Error = 8;
	}
	&_RunModule('post');
	&_POST_REBUILD;
}
1;