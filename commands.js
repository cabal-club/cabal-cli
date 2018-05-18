var util = require("./util.js")
var through = require("through2")

function Commander(view, cabal) {
    if (!(this instanceof Commander)) return new Commander(view, cabal)
    var self = this
    this.cabal = cabal
    this.channel = "default"
    this.view = view
    this.pattern = (/\/(\w*)\s*(.*)/)
}

Commander.prototype.process = function(line) {
    var self = this
    var match = self.pattern.exec(line)
    var cmd = match && match[1] || ""
    var arg = match && match[2] || ""
    arg = arg.trim()

    if (cmd === "put") {
        var [key, value] = arg.split("=")
        self.cabal.db.put(key, value, util.log)
    } else if (cmd === "list") {
        self.cabal.getChannels((err, channels) => {
            channels.map(self.view.writeLine.bind(self.view))
        })
    } else if (cmd === "chat") {
        if (arg !== '') {
            cabal.message(channel, arg)
        }
    } else if (cmd === "nick") {
        if (arg == '') return
        self.cabal.username = arg
    } else if (cmd === "get") {
        self.cabal.db.get(arg, console.log)
    } else if (cmd === "all") {
        var stream = cabal.db.createHistoryStream()
        stream.pipe(through.obj(function(chunk, enc, next) {
            console.log(chunk)
            next()
        }))
    } else if (cmd === "change") {
        if (arg == '') arg = 'what'
        self.channel = arg
        self.view.changeChannel(arg)
    } else if (cmd === "auth") { self.cabal.db.authorize(Buffer.from(arg, "hex"), util.log)
    } else if (cmd === "local") { console.log("local key is\n\t", self.cabal.db.local.key.toString("hex"))
    } else if (cmd === "db") { console.log("db key is\n\t", self.cabal.db.key.toString("hex"))
    } else if (cmd === "registered") { self.cabal.db.authorized(Buffer.from(arg, "hex"), util.log)
    } else {
        line = line.trim()
        if (line !== '') {
            cabal.message(self.channel, line)
        }
    }
}

function loadChannel(name) {
    var channel = `channels/${name}`
    // monitor(channel)
    interface.getMessages(channel, 25, (messages) => {
        messages.map((m) => {
            self.view.writeMessage.bind(self.view)(m)
        })
    })
}

module.exports = Commander
