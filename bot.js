const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("ytdl-core");
const request = require("request");
const fs = require("fs");
const getYouTubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");

var config = JSON.parse(fs.readFileSync('./auth.json', 'utf-8'));

const yt_api_key = config.youtube_api_key;
const bot_constroller = config.role;
const prefix = config.prefix;
const discord_token = config.token;

var queue = [];
var isPlaying = false;
var dispatcher = null;
var voiceChannel = null;
var skipReq = 0;
var skippers = [];
var streamOptions = null;
var currentVolume = 0.20;


client.on('message', function(message) {
	if (message.author.bot) return;
	const member = message.member;
	const mess = message.content.toLowerCase();
	const args = message.content.split(' ').slice(1).join(" ");
	if (mess.startsWith(prefix)) {
		var command = mess.substring(1);
		if (command.startsWith("play")) {
			commandPlay(message, args);
		} else if (command.startsWith("hello")) {
			message.reply("hello!");
		} else if (command.startsWith("pause")) {
			if (dispatcher != null && !dispatcher.paused) {
				dispatcher.pause();
				message.channel.send("Paused.");
			}
		} else if (command.startsWith("resume")) {
			if (dispatcher != null && dispatcher.paused) {
				dispatcher.resume();
				message.channel.send("Resuming...");
			}
		} else if (command.startsWith("volume")) {
			var argsNum = parseFloat(args);
			if (typeof argsNum === 'number' && argsNum <= 1) {
				currentVolume = argsNum;
				if (streamOptions != null) {
					streamOptions['volume'] = currentVolume;
				}
				message.channel.send("Set the current volume to: " + argsNum);
			} 
		} else if (command.startsWith("stop")) {
			if (dispatcher != null) {
				dispatcher.end();
				message.channel.send("Stopped.");
			}
		} else if (command.startsWith("queue")) {
			if (queue.length == 0) {
				message.channel.send("The queue is currently empty.");
				return;
			}
			var nums = Math.min(queue.length, 10);
			output = "";
			for (var i = 0; i < nums; i ++) {
				fetchVideoInfo(queue[i].id, function (err, videoInfo) {
					if (err) throw new Error(err);
					output += i + ". **" + videoInfo.title + "**\n";
				});
			}
			message.channel.send(output);
		}
	}

});

client.on('ready', function() {
	console.log("This is: " + client.user.username);
	console.log("I am ready!");
});

client.on('guildMemberAdd', function(member) {
	var channel = member.guild.channels.find('name', 'member-log');
	if (!channel) return;
	channel.send('Welcome to the server, ${member}');
});

function commandPlay(message, args) {
// Check to see if the caller is in a voice channel that the bot can play to
	if (message.member.voiceChannel || voiceChannel != null) {
		// Block of code for adding song to queue
		if (dispatcher != null) {
			if (!dispatcher.speaking) isPlaying = false;
		}
		if (queue.length > 0 || isPlaying) {
			getID(args, function(id) {
				add_to_queue(id, message);                    
				fetchVideoInfo(id, function(err, videoInfo) {
					if (err) throw new Error(err);
					message.channel.send(" added to queue: **" + videoInfo.title + "**");
				});
			});
		} else {
			// Play song immediately
			isPlaying = true;
			console.log("hello");
			console.log(isPlaying);
			getID(args, function(id) {
				startPlayMusic(id, message);
				fetchVideoInfo(id, function(err, videoInfo) {
					if (err) throw new Error(err);
					message.channel.send(" now playing: **" + videoInfo.title + "**");
				});
			});
		}
	} else {
		message.reply(" you need to be in a voice channel!");
	}
}

function startPlayMusic(id, message) {
	voiceChannel = message.member.voiceChannel;
	streamOptions = { seek: 0, volume: currentVolume };

	voiceChannel.join().then(function (connection) {
		stream = ytdl("http://wwww.youtube.com/watch?v=" + id, {
			filter: 'audioonly'
		});

		dispatcher = connection.playStream(stream, streamOptions);
	}).then(playMusic);
}

function playMusic() {
	if (queue.length == 0) {
		return;
	} else {
		var obj = queue.shift();
		var message = obj.message;
		var id = obj.id;
		voiceChannel = message.member.voiceChannel;
		streamOptions = { seek: 0, volume: currentVolume };

		voiceChannel.join().then(function (connection) {
			stream = ytdl("http://wwww.youtube.com/watch?v=" + id, {
				filter: 'audioonly'
			});

			dispatcher = connection.playStream(stream, streamOptions);
		}).then(playMusic);
	}
}

// Checks to see if str is a youtube link:
// 		if yes: using callback function (typically involving playmusic) to play the link
//      else: using function search_video to search google api for youtube video
function getID(str, cb) {
	if (isYoutube(str)) {
		cb(getYouTubeID(str));
	} else {
		search_video(str, function(id) {
			cb(id);
		});
	}
}

// Called when queue length > 0 or there is a song playing
function add_to_queue(strID, message) {
	if (isYoutube(strID)) {
		queue.push({id: getYouTubeID(strID), message: message});
	} else {
		queue.push({id: strID, message: message});
	}
}

// JSON request to google api to search for a video using our youtube data api key
function search_video(query, callback) {
	request("https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=" + encodeURIComponent(query) + "&key=" + yt_api_key, function(error, response, body) {
		var json = JSON.parse(body);
		if (!json.items[0]) callback("3_-a9nVZYjk");
		else {
			callback(json.items[0].id.videoId);
		}
	});
}

// checks link to see if it is a youtube link
function isYoutube(str) {
	return str.toLowerCase().indexOf("youtube.com") > -1;
}

client.login(discord_token);