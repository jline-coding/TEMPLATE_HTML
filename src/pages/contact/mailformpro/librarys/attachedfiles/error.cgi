for(my $cnt=0;$cnt<@att_file_names;$cnt++){
	if(-f $att_file_names[$cnt]){
		unlink $att_file_names[$cnt];
	}
}
1;