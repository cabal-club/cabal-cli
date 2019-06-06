var util = require('./util')

function Commander (view, cabal) {
  if (!(this instanceof Commander)) return new Commander(view, cabal)
  this.cabal = cabal
  this.channel = '!status'
  this.view = view
  this.pattern = (/^\/(\w*)\s*(.*)/)
  this.history = []

  var self = this
  this.commands = {
    nick: {
      help: () => 'change your display name',
      call: (arg) => {
        if (arg === '') return
        self.cabal.publishNick(arg)
        self.view.writeLine("* you're now known as " + arg)
      }
    },
    emote: {
      help: () => 'write an old-school text emote',
      call: (arg) => {
        self.cabal.publish({
          type: 'chat/emote',
          content: {
            channel: self.channel,
            text: arg
          }
        })
      }
    },
    names: {
      help: () => 'display the names of the currently online peers',
      call: (arg) => {
        self.cabal.users.getAll(function (err, users) {
          if (err) { return }
          var userkeys = Object.keys(users).map((key) => users[key]).sort(util.cmpUser)
          self.view.writeLine('* history of peers in this cabal:')
          userkeys.map((u) => {
            var username = u.name || 'conspirator'
            var spaces = ' '.repeat(15)
            var paddedName = (username + spaces).slice(0, spaces.length)
            self.view.writeLine.bind(self.view)(`  ${paddedName} ${u.key}`)
          })
        })
      }
    },
    channels: {
      help: () => "display the cabal's channels",
      call: (arg) => {
        self.cabal.channels.get((err, channels) => {
          if (err) return
          self.view.writeLine('* channels:')
          channels.map((m) => {
            self.view.writeLine.bind(self.view)(`  ${m}`)
          })
        })
      }
    },
    join: {
      help: () => 'join a new channel',
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
          self.view.writeLine.bind(self.view)(`/${key}`)
          self.view.writeLine.bind(self.view)(`  ${self.commands[key].help()}`)
        }
        self.view.writeLine.bind(self.view)(`alt-n`)
        self.view.writeLine.bind(self.view)(`  move between channels/cabals panes`)
        self.view.writeLine.bind(self.view)(`ctrl+{n,p}`)
        self.view.writeLine.bind(self.view)(`  move up/down channels/cabals`)
      }
    },
    quit: {
      help: () => 'exit the cabal process',
      call: (arg) => {
        process.exit(0)
      }
    },
    exit: {
      help: () => 'exit the cabal process',
      call: (arg) => {
        process.exit(0)
      }
    },
    topic: {
      help: () => 'set the topic/description/`message of the day` for a channel',
      call: (arg) => {
        self.cabal.publishChannelTopic(self.channel, arg)
      }
    },
    whoami: {
      help: () => 'display your local user key',
      call: (arg) => {
        self.view.writeLine.bind(self.view)('Local user key: ' + self.cabal.client.user.key)
      }
    }
  }
  // add aliases to commands
  this.alias('emote', 'me')
  this.alias('join', 'j')
  this.alias('nick', 'n')
  this.alias('topic', 'motd')
  this.alias('whoami', 'key')

  // add in experimental commands
  if (self.view.isExperimental) {
    self.commands['add'] = {
      help: () => 'add a cabal',
      call: (arg) => {
        if (arg === '') {
          self.view.writeLine('* Usage example: /add cabalkey')
          return
        }
        self.channel = arg
        self.view.addCabal(arg)
      }
    }
    self.alias('add', 'cabal')
  }
}

Commander.prototype.alias = function (command, alias) {
  var self = this
  self.commands[alias] = {
    help: self.commands[command].help,
    call: self.commands[command].call
  }
}

Commander.prototype.process = function (line) {
  var self = this
  line = line.trim()
  self.history.push(line)
  if (self.history.length > 1000) self.history.shift()
  var match = self.pattern.exec(line)
  var cmd = match ? match[1] : ''
  var arg = match ? match[2] : ''
  arg = arg.trim()
  if (cmd in self.commands) {
    self.commands[cmd].call(arg)
  } else if (cmd) {
    self.view.writeLine(`${cmd} is not a command, type /help for commands`)
  } else if (self.channel === '!status') {
    self.view.writeLine(line)
  } else {
    line = line.trim()
    if (line !== '') {
      self.cabal.publish({
        type: 'chat/text',
        content: {
          channel: self.channel,
          text: line
        }
      })
    }
  }
}

module.exports = Commander
