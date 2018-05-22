var neatLog = require('neat-log')
var output = require('./output')
var strftime = require('strftime')
var Commander = require('./commands.js')
var chalk = require('chalk')

// TODO:
// * introduce messages types
//   type: chat/text
//   type: chat/info
//
// * rewrite usage of state.messages,
//   look at substack's approach in the og chatmesh

const HEADER_ROWS = 6

function NeatScreen (cabal) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(cabal)
  var self = this

  this.cabal = cabal
  this.commander = Commander(this, cabal)
  this.watcher = null

  this.neat = neatLog(view, {fullscreen: true,
    style: function (start, cursor, end) {
      if (!cursor) cursor = ' '
      return start + chalk.underline(cursor) + end
    }}
  )
  this.neat.input.on('update', () => this.neat.render())
  this.neat.input.on('enter', (line) => this.commander.process(line))

  this.neat.input.on('tab', () => {
    var users = Object.keys(self.cabal.users).sort()
    var line = self.neat.input.rawLine()
    var pattern = (/^(\w+)$/)
    var match = pattern.exec(line)

    if (match) {
      users = users.filter(user => user.startsWith(match[0]))
      if (users.length > 0) self.neat.input.set(users[0] + ': ')
    }
  })

  this.neat.input.on('up', () => {
    if (self.commander.history.length) {
      var command = self.commander.history.pop()
      self.commander.history.unshift(command)
      self.neat.input.set(command)
    }
  })

  this.neat.input.on('down', () => {
    if (self.commander.history.length) {
      var command = self.commander.history.shift()
      self.commander.history.push(command)
      self.neat.input.set(command)
    }
  })

  this.neat.input.on('ctrl-u', () => self.neat.input.set(''))
  this.neat.input.on('ctrl-d', () => process.exit(0))

  this.neat.use(function (state, bus) {
    self.state = state
    self.bus = bus
    // load initial state of the channel
    self.loadChannel('default')
  })
  self.cabal.on('join', (username) => {
    self.writeLine(`* ${username} joined`)
  })

  self.cabal.on('leave', (username) => {
    self.writeLine(`* ${username} left`)
  })

  function view (state) {
    var MAX_MESSAGES = process.stdout.rows - HEADER_ROWS
    var msgs = state.messages
    if (msgs.length < MAX_MESSAGES) {
      msgs = msgs.concat(Array(MAX_MESSAGES - msgs.length).fill())
    } else {
      msgs = msgs.slice(msgs.length - MAX_MESSAGES, msgs.length)
    }

    return output(`${chalk.gray('Cabal')}
dat://${self.cabal.db.key.toString('hex')}

${msgs.join('\n')}
[${chalk.cyan(self.cabal.username)}:${state.channel}] ${self.neat.input.line()}`)
  }
}

// use to write anything else to the screen, e.g. info messages or emotes
NeatScreen.prototype.writeLine = function (line) {
  this.state.messages.push(`${chalk.gray(line)}`)
  this.bus.emit('render')
}

NeatScreen.prototype.clear = function () {
  this.state.messages = []
  this.bus.emit('render')
}

NeatScreen.prototype.loadChannel = function (channel) {
  var self = this
  self.state.channel = channel
  var MAX_MESSAGES = process.stdout.rows - HEADER_ROWS
  // clear the old messages array
  self.state.messages = []
  // if we monitor a new channel, destroy the old watcher first
  if (self.watcher) self.watcher.destroy()

  function onMessages (err, messages) {
    if (err) return
    messages.map((arr) => {
      arr.forEach((m) => {
        self.state.messages.push(self.formatMessage(m))
      })
    })
    self.neat.render()
  }
  self.cabal.getMessages(channel, MAX_MESSAGES, onMessages)

  self.watcher = self.cabal.watch(channel, () => {
    self.cabal.getMessages(channel, 1, onMessages)
  })
}

NeatScreen.prototype.render = function () {
  this.bus.emit('render')
}

NeatScreen.prototype.formatMessage = function (msg) {
  var self = this
  var hilight = false
  var user = self.cabal.username
  if (msg.value) { msg = msg.value }
  if (msg.content && msg.author && msg.time) {
    if (msg.content.indexOf(user) > -1 && msg.author !== user) { hilight = true }

    var text = `${chalk.gray(formatTime(msg.time))} ${chalk.gray('<')}${chalk.cyan(msg.author)}${chalk.gray('>')} ${msg.content}`
    return hilight ? chalk.bgRed(chalk.black(text)) : text
  }
  return chalk.cyan('unknown message type: ') + chalk.gray(JSON.stringify(msg))
}

function formatTime (t) {
  return strftime('%T', new Date(t))
}

module.exports = NeatScreen
