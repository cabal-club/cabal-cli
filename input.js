var readline = require("readline")
var through = require("through2")
var Interface = require("./interface.js")
var Screen = require("./simple-screen.js")
var util = require("./util.js")

function readInput(db, nick) {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    })

    var currentChannel = "default"

    var interface = Interface(db)
    var screen = Screen()
    var watcher

    loadChannel(currentChannel)

    function monitor(channel) {
        // if we monitor a new channel, destroy the old watcher first
        if (watcher) watcher.destroy()
        watcher = db.watch(channel, () => {
            console.log("\033[2J") // hack: clear screen
            interface.getMessages(channel, 25).then((msg) => {
                msg.map(screen.writeMessage)
            })
        })
    }

    var pattern = (/\.(\w*)\s*(.*)/)
    rl.on("line", function(line) {
        var match = pattern.exec(line)
        var cmd = match && match[1] || ""
        var arg = match && match[2] || ""

        if (cmd === "put") {
            var [key, value] = arg.split("=")
            db.put(key, value, util.log)
        } else if (cmd === "test") {
            interface.test()
        } else if (cmd === "list") {
            interface.getChannels().then((channels) => {
                channels.map(screen.writeLine)
            })
        } else if (cmd === "chat") {
            var channel = `channels/${currentChannel}`
            interface.writeMessage(channel, nick, arg)
        } else if (cmd === "nick") {
            nick = arg
        } else if (cmd === "get") { db.get(arg, util.log)
        } else if (cmd === "all") {
            var stream = db.createHistoryStream()
            stream.pipe(through.obj(function(chunk, enc, next) {
                console.log(chunk)
                next()
            }))
        } else if (cmd === "change") {
            currentChannel = arg
            loadChannel(currentChannel)
            console.log("\033[2J") // hack: clear screen
        } else if (cmd === "read") {
            var channel = `channels/${currentChannel}`
            interface.getMessages(channel, 20).then((messages) => {
                messages.map(screen.writeMessage)
            })
        } else if (cmd === "auth") { db.authorize(Buffer.from(arg, "hex"), util.log)
        } else if (cmd === "local") { console.log("local key is\n\t", db.local.key.toString("hex"))
        } else if (cmd === "db") { console.log("db key is\n\t", db.key.toString("hex"))
		} else if (cmd === "registered") { db.authorized(Buffer.from(arg, "hex"), util.log)
		} else {
			var channel = `channels/${currentChannel}`
            interface.writeMessage(channel, nick, line)
		}
    })

    function loadChannel(name) {
        var channel = `channels/${name}`
        monitor(channel)
        interface.getMessages(channel, 25).then((msg) => {
            msg.map(screen.writeMessage)
        })
    }
}

module.exports = readInput
