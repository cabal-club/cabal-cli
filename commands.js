var util = require('./util')
var chalk = require('chalk')
var qr = require('qrcode')

function Commander (view, client) {
  if (!(this instanceof Commander)) return new Commander(view, client)
  this.client = client
  this.cabal = client.getCurrentCabal()
  this.channel = '!status'
  this.view = view
  this.pattern = (/^\/(\w*)\s*(.*)/)
  this.history = []
  this.aliases = {}

  this.commands = {
    add: {
      help: () => 'add a cabal',
      call: (arg) => {
        if (arg === '') {
          this.view.writeLine('* Usage example: /add <cabalkey>')
          return
        }
        this.client.addCabal(arg)
      }
    },
    new: {
      help: () => 'create a new cabal',
      call: (arg) => {
        this.client.createCabal()
      }
    },
    nick: {
      help: () => 'change your display name',
      call: (arg) => {
        if (arg === '') return
        this.cabal.publishNick(arg)
        this.view.writeLine("* you're now known as " + util.sanitizeString(arg))
      }
    },
    emote: {
      help: () => 'write an old-school text emote',
      call: (arg) => {
        this.cabal.publishMessage({
          type: 'chat/emote',
          content: {
            channel: this.channel,
            text: arg
          }
        })
      }
    },
    names: {
      help: () => 'display the names of the currently online peers',
      call: (arg) => {
        var logToView = this.logger()
        var users = this.cabal.getUsers()
        var userkeys = Object.keys(users).map((key) => users[key]).sort(util.cmpUser)
        logToView('* history of peers in this cabal')
        userkeys.map((u) => {
          var username = util.sanitizeString(u.name) || 'conspirator'
          var spaces = ' '.repeat(15)
          var paddedName = (username + spaces).slice(0, spaces.length)
          logToView(`  ${paddedName} ${u.key}`)
        })
      }
    },
    channels: {
      help: () => "display the cabal's channels",
      call: (arg) => {
        var logToView = this.logger()
        var joinedChannels = this.cabal.getJoinedChannels()
        var channels = this.cabal.getChannels()
        logToView(`there are currently ${channels.length} channels `)
        channels.map((c) => {
          var topic = this.cabal.getTopic(c)
          if (topic.length > 0 && topic.length > 20) topic = topic.slice(0, 40) + '..'
          var count = this.cabal.getChannelMembers(c).length
          var userPart = count ? `: ${count} ${count === 1 ? 'person' : 'people'}` : ''
          var topicPart = topic.length > 0 ? ` ${chalk.cyan(topic)}` : ''
          logToView(`  ${joinedChannels.includes(c) ? '*' : ' '} ${c}${userPart}${topicPart}`)
        })
      }
    },
    panes: {
      help: () => 'set pane to navigate up and down in. panes: channels, cabals',
      call: (arg) => {
        if (arg === '' || !['channels', 'cabals'].includes(arg)) return
        this.view.setPane(arg)
      }
    },
    join: {
      help: () => 'join a new channel',
      call: (arg) => {
        if (arg === '') arg = 'default'
        this.channel = arg
        this.cabal.joinChannel(arg)
        this.view.loadChannel(arg)
      }
    },
    leave: {
      help: () => 'leave a channel',
      call: (arg) => {
        if (arg === '!status') return
        /* TODO: update `this.channel` with next channel */
        this.cabal.leaveChannel(arg)
      }
    },
    clear: {
      help: () => 'clear the current backscroll',
      call: (arg) => {
        this.view.clear()
        this.client.clearStatusMessages()
      }
    },
    help: {
      help: () => 'display this help message',
      call: (arg) => {
        var logToView = this.logger()
        var foundAliases = {}
        for (var key in this.commands) {
          if (foundAliases[key]) { continue }
          const slash = chalk.gray('/')
          let command = key
          if (this.aliases[key]) {
            foundAliases[this.aliases[key]] = true
            command += `, ${slash}${this.aliases[key]}`
          }
          logToView(`${slash}${command}`)
          logToView(`  ${this.commands[key].help()}`)
        }
        logToView(`alt-n`)
        logToView(`  move between channels/cabals panes`)
        logToView(`ctrl+{n,p}`)
        logToView(`  move up/down channels/cabals`)
      }
    },
    qr: {
      help: () => "generate a qr code with the current cabal's address",
      call: () => {
        const logToView = this.logger()
        const cabalKey = `cabal://${this.cabal.key}`
        qr.toString(cabalKey, { type: 'terminal' }, (err, qrcode) => {
          if (err) return
          logToView(`QR code for ${cabalKey}\n\n${qrcode}`)
        })
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
        this.cabal.publishChannelTopic(this.channel, arg)
      }
    },
    whoami: {
      help: () => 'display your local user key',
      call: (arg) => {
        this.view.writeLine.bind(this.view)('Local user key: ' + this.cabal.getLocalUser().key)
      }
    },
    whois: {
      help: () => 'display the public keys associated with the passed in nick',
      call: (arg) => {
        const users = this.cabal.getUsers()
        let whoisKeys = Object.keys(users).filter((k) => users[k].name && users[k].name === arg)
        const logToView = this.logger()
        logToView(`* ${arg}'s public keys:`)
        // list all of arg's public keys in list
        for (var key of whoisKeys) {
          logToView(`  ${key}`)
        }
      }
    }
  }
  // add aliases to commands
  this.alias('emote', 'me')
  this.alias('join', 'j')
  this.alias('leave', 'l')
  this.alias('nick', 'n')
  this.alias('topic', 'motd')
  this.alias('whoami', 'key')
  this.alias('add', 'cabal')
}

// for use when writing multiple logs within short intervals
// to keep timestamp ordering correct. see usage for the `help` command above
Commander.prototype.logger = function () {
  var counter = -1000 // set counter 1000 ms in the past to prevent status messages from being purged due to being in the future
  function ts () {
    return Date.now() + counter++
  }
  var logToView = (msg) => {
    this.view.writeLine.bind(this.view)(msg, ts())
  }
  return logToView
}

Commander.prototype.alias = function (command, alias) {
  this.aliases[command] = alias
  this.commands[alias] = {
    help: this.commands[command].help,
    call: this.commands[command].call
  }
}

Commander.prototype.process = function (line) {
  line = line.trim()
  this.history.push(line)
  if (this.history.length > 1000) this.history.shift()
  var match = this.pattern.exec(line)
  var cmd = match ? match[1] : ''
  var arg = match ? match[2] : ''
  arg = arg.trim()
  if (cmd in this.commands) {
    this.commands[cmd].call(arg)
  } else if (cmd) {
    this.view.writeLine(`${cmd} is not a command, type /help for commands`)
  } else {
    if (this.channel === '!status') { return } // disallow typing to !status
    line = line.trim()
    if (line !== '') {
      this.cabal.publishMessage({
        type: 'chat/text',
        content: {
          channel: this.channel,
          text: line
        }
      })
      this.client.markChannelRead()
    }
  }
}

module.exports = Commander
