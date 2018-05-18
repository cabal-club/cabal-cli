var readline = require("readline")
var through = require("through2")
var Interface = require("./interface.js")
var Screen = require("./neat-screen.js")
var util = require("./util.js")

function readInput(db, nick) {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    })

    var currentChannel = "default"

    var interface = Interface(db)
    var screen = Screen(inputHandler)
    var watcher

    loadChannel(currentChannel)

    function inputHandler(state, bus) {
        state.messages = []
        bus = bus
        state.channel = "default"
        bus.emit("render")
        console.log(screen)
    }

    function monitor(channel) {
        // if we monitor a new channel, destroy the old watcher first
        if (watcher) watcher.destroy()
        watcher = db.watch(channel, () => {
            interface.getMessages(channel, 25).then((msg) => {
                msg.map((m) => {
                    screen.writeMessage.bind(screen)(m)
                })
            })
        })
    }

    var pattern = (/\.(\w*)\s*(.*)/)
    rl.on("line", function(line) {
    })

	function writeMessage(msg) {
		var channel = `channels/${currentChannel}`
		interface.writeMessage(channel, nick, msg)
	}

    function loadChannel(name) {
        var channel = `channels/${name}`
        monitor(channel)
        interface.getMessages(channel, 25).then((msg) => {
            msg.map((m) => {
                screen.writeMessage.bind(screen)(m)
            })
        })
    }
}

module.exports = readInput
