const Discord = require("discord.js");
const fs = require("fs");
const { prefix, token } = require("./config.json");

const client = new Discord.Client();

const queue = new Map();

const fullLives = fs.readdirSync('lives/');
const songs = fs.readdirSync('songs/');
const lives = fullLives.filter(value => !value.includes('Hazure'));
const hazures = fullLives.filter(value => value.includes('Hazure'));

function getRandomBlank() {
    const songInfo = {};
    const index = Math.floor(Math.random() * 3)  ;
    songInfo.title = 'K.K. Blank ' + index;
    songInfo.path = hazures[index - 1];
    return songInfo;
}

client.once("ready", () => {
    console.log("Ready!");
});

client.once("reconnecting", () => {
    console.log("Reconnecting!");
});

client.once("disconnect", () => {
    console.log("Disconnect!");
});

client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix} live`)) {
        execute(message, serverQueue, 'live');
    } else if (message.content.startsWith(`${prefix} play`)) {
        execute(message, serverQueue, 'play');
    } else if (message.content.startsWith(`${prefix} skip`)) {
        skip(message, serverQueue);
    } else if (message.content.startsWith(`${prefix} stop`)) {
        stop(message, serverQueue);
    } else {
        message.channel.send("You need to enter a valid command!");
    }
});

async function execute(message, serverQueue, type) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "You need to be in a voice channel to play music!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }

    let songInfo = {};
    if (args[2] == null) {
        if (type === 'live')
            songInfo = getRandomBlank();
        else {
            message.channel.send('Usage: `!kk play <id>`');
            return;
        }
    } else {
        const song = (type === 'live' ? lives : songs).filter(value => value.includes(args[2]))[0];
        if (song == null) {
            if (type === 'live')
                songInfo = getRandomBlank();
            else {
                message.channel.send(`Not found: **${args[2]}**`);
                return;
            }
        } else {
            songInfo.title = 'K.K. Song ID: ' + args[2] + (type === 'live' ? ' (Live Ver.)' : '');
            songInfo.path = song;
        }
    }

    const song = {
        title: songInfo.title,
        path: (type === 'live' ? 'lives/' : 'songs/') + songInfo.path
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (serverQueue != null) {
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(song.path)
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

client.login(token);
