use HTTP::Tiny;
use JSON::PP;
my $url = $config{"Deepseek.endpoint"};
my $api_key = $config{"Deepseek.APIKey"};
my $prompt = $_TEXT{'Deepseek.prompt'};
my $data = {
	model => $config{"Deepseek.model"},
	messages => [
		{
			role => "user",
			content => $prompt
		}
	],
	stream => JSON::PP::false,
};
my $json = JSON::PP->new->utf8->encode($data);
my $http = HTTP::Tiny->new(
	verify_SSL => 1,
	timeout    => 10
);
my $response = $http->post($url, {
	headers => {
		"Content-Type"  => "application/json",
		"Authorization" => "Bearer $api_key"
	},
	content => $json
});
if ($response->{success}) {
	my $res_data = decode_json($response->{content});
	$_ENV{'Deepseek'} = $res_data->{choices}[0]{message}{content};
	#&_SAVE("./deepseek.txt",$_ENV{'Deepseek'});
}
1;