use MIME::Base64;
use Encode;
use LWP::UserAgent;
use HTTP::Request::Common qw(POST);
use HTTP::Request;
$ENV{'PERL_LWP_SSL_VERIFY_HOSTNAME'} = 0;
my $ua = LWP::UserAgent->new;
#$ua->ssl_opts( verify_hostname => 0 );
$ua->timeout(10);
$ua->agent('Mozilla/5.0 (compatible; DiscordWebhookBot/1.0; +https://synck.com)');
$ua->default_header('Content-Type' => "application/json");
my $url = $config{'discord.webhook'};
$_TEXT{'discord.Message'} =~ s/\r//ig;
$_TEXT{'discord.Message'} =~ s/\n/\\n/ig;
$_TEXT{'discord.Message'} =~ s/\"/&quot;/ig;
my $json = <<__POST_JSON__;
{
	"content": "$_TEXT{'discord.Message'}"
}
__POST_JSON__
my $req= HTTP::Request->new(POST => $url);
$req->content($json);
my $callback = $ua->request($req)->content;
1;