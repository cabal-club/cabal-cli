var neatLog = require('neat-log')
var output = require('neat-log/output')
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

function NeatScreen (cabal) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(cabal)
  var self = this

  this.cabal = cabal
  this.commander = Commander(this, cabal)
  this.MAX_MESSAGES = process.stdout.rows - 1
  this.watcher = null

  this.neat = neatLog(view, {fullscreen: true,
    style: function (start, cursor, end) {
      if (!cursor) cursor = ' '
      return start + chalk.underline(cursor) + end
    }}
  )
  this.neat.input.on('update', () => this.neat.render())
  this.neat.input.on('enter', (line) => this.commander.process(line))

  this.neat.use(function (state, bus) {
    self.state = state
    self.bus = bus
    state.messages = []
    state.channel = 'default'

    // load initial state of the channel
    self.monitor(state.channel)
    self.loadChannel(state.channel)

    cabal.on('message', (msg) => {
      state.messages.push(self.formatMessage(msg))
      bus.emit('render')
    })
  })

  function view (state) {
    return output(`
            ${chalk.gray('cabal key:')} ${self.cabal.db.key.toString('hex')}
            ${createMessage(state.messages).join('\n')}
            [${chalk.cyan(self.cabal.username)}:${state.channel}] ${self.neat.input.line()}`)
  }
}

// use to write anything else to the screen, e.g. info messages or emotes
NeatScreen.prototype.writeLine = function (line) {
  this.state.messages.push(line)
  this.bus.emit('render')
}

NeatScreen.prototype.monitor = function (channel) {
  var self = this
  // if we monitor a new channel, destroy the old watcher first
  if (self.watcher) self.watcher.destroy()
  self.watcher = self.cabal.db.watch(channel, () => {
    self.loadChannel(channel)
  })
}

NeatScreen.prototype.changeChannel = function (channel) {
  var self = this
  self.state.channel = channel
  self.monitor(channel)
  self.loadChannel(channel)
}

NeatScreen.prototype.clear = function () {
  this.state.messages = []
  this.bus.emit('render')
}

NeatScreen.prototype.loadChannel = function (channel) {
  var self = this
  // clear the old messages array
  self.state.messages = []
  self.state.channel = channel
  self.cabal.getMessages(channel, self.MAX_MESSAGES, (err, messages) => {
    if (err) return
    messages.map((arr) => {
      arr.forEach((m) => self.state.messages.push(self.formatMessage(m)))
    })
    self.bus.emit('render')
  })
}

NeatScreen.prototype.formatMessage = function (msg) {
  var self = this
  var hilight = false
  var user = self.cabal.username
  if (msg.value) { msg = msg.value }
  if (msg.content.indexOf(user) > -1 && msg.author !== user) { hilight = true }

  var text = `${chalk.gray(formatTime(msg.time))} ${chalk.gray('<')}${chalk.cyan(msg.author)}${chalk.gray('>')} ${msg.content}`
  return hilight ? chalk.bgRed(chalk.black(text)) : text
}

function createMessage (messages) {
  return messages.concat(Array(process.stdout.rows)).slice(0, process.stdout.rows - 2)
}

function formatTime (t) {
  return strftime('%T', new Date(t))
}

module.exports = NeatScreen
