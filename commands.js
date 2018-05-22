var through = require('through2')

function Commander (view, cabal) {
  if (!(this instanceof Commander)) return new Commander(view, cabal)
  this.cabal = cabal
  this.channel = 'default'
  this.view = view
  this.pattern = (/^\/(\w*)\s*(.*)/)

  var self = this
  this.commands = {
    nick: {
      help: () => 'change your display name',
      call: (arg) => {
        if (arg === '') return
        self.cabal.username = arg
        self.view.writeLine("* you're now known as " + arg)
      }
    },
    names: {
      help: () => 'display the names of the currently logged in users',
      call: (arg) => {
        var users = Object.keys(self.cabal.users)
        self.view.writeLine('* currently connected users:')
        users.map((u) => self.view.writeLine.bind(self.view)(`  ${u}`))
      }
    },
    channels: {
      help: () => "display the cabal's channels",
      call: (arg) => {
        self.cabal.getChannels((err, channels) => {
          if (err) return
          self.view.writeLine('* channels:')
          channels.map((m) => {
            self.view.writeLine.bind(self.view)(`  ${m}`)
          })
        })
      }
    },
    change: {
      help: () => 'change to a new channel',
      call: (arg) => {
        if (arg === '') arg = 'default'
        self.channel = arg
        self.view.loadChannel(arg)
      }
    },
    clear: {
      help: () => 'clear the current backscroll',
      call: (arg) => {
        self.view.clear()
      }
    },
    help: {
      help: () => 'display this help message',
      call: (arg) => {
        for (var key in self.commands) {
          self.view.writeLine(`/${key}\n  ${self.commands[key].help()}`)
        }
      }
    },
    debug: {
      help: () => 'debug hyperdb keys',
      call: (arg) => {
        var stream = self.cabal.db.createHistoryStream()
        stream.pipe(through.obj(function (chunk, enc, next) {
          if (chunk.key.indexOf(arg) > -1) {
            self.view.writeLine.bind(self.view)(chunk.key + ': ' + JSON.stringify(chunk.value))
          }
          next()
        }))
      }
    },
    quit: {
      help: () => 'exit the cabal process',
      call: (arg) => {
        process.exit(0)
      }
    }
  }
}

Commander.prototype.process = function (line) {
  var self = this
  var match = self.pattern.exec(line)
  var cmd = match ? match[1] : ''
  var arg = match ? match[2] : ''
  arg = arg.trim()
  if (cmd in self.commands) {
    self.commands[cmd].call(arg)
  } else if (cmd) {
    self.view.writeLine(`${cmd} is not a command, type /help for commands`)
  } else {
    line = line.trim()
    if (line !== '') {
      self.cabal.message(self.channel, line)
    }
  }
}

module.exports = Commander
