use HTTP::Tiny;
use JSON::PP;
my $url = $config{"ChatGPT.endpoint"};
my $api_key = $config{"ChatGPT.APIKey"};
my $prompt = $_TEXT{'ChatGPT.prompt'};
my $data = {
	model => $config{"ChatGPT.model"},
	messages => [
		{ role => "user", content => $prompt }
	],
	temperature => 0.3,
	max_tokens => 256
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
	$_ENV{'ChatGPT'} = $res_data->{choices}[0]{message}{content};
}
1;