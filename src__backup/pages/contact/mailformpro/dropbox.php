<?php

ini_set("max_execution_time",0);
$tmpinclude = "./data/temp/" . $_GET['key'] . ".php";
if(file_exists($tmpinclude)){
	include $tmpinclude;
}
error_reporting(E_ALL);

require_once "../../../../vendor/autoload.php";
use Kunnu\Dropbox\Dropbox;
use Kunnu\Dropbox\DropboxApp;
use Kunnu\Dropbox\DropboxFile;

$app = new DropboxApp($AppKey, $SecretKey, $AccessToken);
$dropbox = new Dropbox($app);

for($i=0;$i<count($UploadFiles);$i++){
	if(file_exists("." . $UploadFiles[$i])){
		$dropboxFile = new DropboxFile(__DIR__ . $UploadFiles[$i]);
		$file = $dropbox->simpleUpload($dropboxFile, $UploadFileNames[$i], ['autorename' => true]);
		if($file_clear){
			unlink("." . $UploadFiles[$i]);
		}
	}
}
unlink($tmpinclude);
header("Location: $thanks_url");
