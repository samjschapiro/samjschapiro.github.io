<?php
// proxy.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/rss+xml; charset=utf-8");

// The feed URL from Substack
$url = "https://samuelschapiro.substack.com/feed";

// Fetch the feed
echo file_get_contents($url);
?>
