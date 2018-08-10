var beep = require('beepbeep')
var neatLog = require('neat-log')
var chalk = require('chalk')
var strftime = require('strftime')
var Commander = require('./commands.js')
var views = require('./views')
var chalk = require('chalk')
var blit = require('txt-blit')
var util = require('./util')

const HEADER_ROWS = 6

function detectMention (msg, user) {
  if (!msg || !msg.content || !msg.author || !msg.type || msg.type !== 'chat/text') return false
  if (msg.content.indexOf(user) > -1 && msg.author !== user) return true
  return false
}

function NeatScreen (cabal) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(cabal)
  var self = this

  this.cabal = cabal
  this.commander = Commander(this, cabal)
  this.watcher = null

  this.neat = neatLog(renderApp, {fullscreen: true,
    style: function (start, cursor, end) {
      if (!cursor) cursor = ' '
      return start + chalk.underline(cursor) + end
    }}
  )
  this.neat.input.on('update', () => this.neat.render())
  this.neat.input.on('enter', (line) => this.commander.process(line))

  this.neat.input.on('tab', () => {
    var line = self.neat.input.rawLine()
    if (line.length > 1 && line[0] === '/') {
      // command completion
      var soFar = line.slice(1)
      var commands = Object.keys(this.commander.commands)
      var matchingCommands = commands.filter(cmd => cmd.startsWith(soFar))
      if (matchingCommands.length === 1) {
        self.neat.input.set('/' + matchingCommands[0])
      }
    } else {
      // nick completion
      var users = Object.keys(self.cabal.users).sort()
      var pattern = (/^(\w+)$/)
      var match = pattern.exec(line)

      if (match) {
        users = users.filter(user => user.startsWith(match[0]))
        if (users.length > 0) self.neat.input.set(users[0] + ': ')
      }
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

  // set channel with alt-#
  this.neat.input.on('alt-1', () => { setChannelByIndex(0) })
  this.neat.input.on('alt-2', () => { setChannelByIndex(1) })
  this.neat.input.on('alt-3', () => { setChannelByIndex(2) })
  this.neat.input.on('alt-4', () => { setChannelByIndex(3) })
  this.neat.input.on('alt-5', () => { setChannelByIndex(4) })
  this.neat.input.on('alt-6', () => { setChannelByIndex(5) })
  this.neat.input.on('alt-7', () => { setChannelByIndex(6) })
  this.neat.input.on('alt-8', () => { setChannelByIndex(7) })
  this.neat.input.on('alt-9', () => { setChannelByIndex(8) })
  this.neat.input.on('alt-0', () => { setChannelByIndex(9) })

  this.neat.input.on('keypress', (ch, key) => {
    if (!key || !key.name) return
    if (key.name === 'home') this.neat.input.cursor = 0
    else if (key.name === 'end') this.neat.input.cursor = this.neat.input.rawLine().length
    else return
    this.bus.emit('render')
  })
  // move up/down channels with ctrl+{n,p}
  this.neat.input.on('ctrl-p', () => {
    var currentIdx = self.state.channels.indexOf(self.commander.channel)
    if (currentIdx !== -1) {
      currentIdx--
      if (currentIdx < 0) currentIdx = self.state.channels.length - 1
      setChannelByIndex(currentIdx)
    }
  })
  this.neat.input.on('ctrl-n', () => {
    var currentIdx = self.state.channels.indexOf(self.commander.channel)
    if (currentIdx !== -1) {
      currentIdx++
      currentIdx = currentIdx % self.state.channels.length
      setChannelByIndex(currentIdx)
    }
  })

  function setChannelByIndex (n) {
    if (n < 0 || n >= self.state.channels.length) return

    self.commander.channel = self.state.channels[n]
    self.loadChannel(self.state.channels[n])
  }

  // TODO: implement simple notifications for messages in channels
  function watchChannels () {
    // watch all channels
    // for each channel
    // remember index/date of last message
    // parse the message to detect mentions
    // if new message, prefix * rune to channel name
    // if mention, prefix ! rune to channel name
    // when loading new channel, clear rune
  }

  this.neat.input.on('ctrl-d', () => process.exit(0))
  this.neat.input.on('pageup', () => self.state.scrollback++)
  this.neat.input.on('pagedown', () => self.state.scrollback = Math.max(0, self.state.scrollback - 1))

  this.neat.use(function (state, bus) {
    state.cabal = cabal
    state.neat = self.neat

    self.state = state
    self.bus = bus

    self.state.messages = []
    self.state.channels = []
    self.state.users = []

    // TODO: use cabal-node api for all of this
    self.cabal.db.ready(function () {
      self.cabal.getChannels((err, channels) => {
        if (err) return
        self.state.channels = channels
        self.loadChannel('default')
        self.bus.emit('render')
      })

      self.cabal.db.api.users.getAll(function (err, users) {
        if (err) return
        state.users = users
        self.bus.emit('render')
      })
    })
  })
}

function renderApp (state) {
  if (process.stdout.columns > 80) return views.big(state)
  else return views.small(state)
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
  // TODO: self.state.cabal.joinChannel(channel)
  self.state.scrollback = 0
  self.state.channel = channel

  var MAX_MESSAGES = process.stdout.rows - HEADER_ROWS
  // clear the old messages array
  self.state.messages = []
  self.state.latest_date = new Date(0)
  // if we monitor a new channel, destroy the old watcher first
  if (self.watcher) self.watcher.destroy()
  this.neat.render()

  function onMessage (msg, redraw) {
    var msgDate = new Date(msg.value.timestamp)
    if (strftime('%F', msgDate) > strftime('%F', self.state.latest_date)) {
      self.state.latest_date = msgDate
      self.state.messages.push(`${chalk.gray('day changed to ' + strftime('%e %b %Y', self.state.latest_date))}`)
    }
    self.state.messages.push(self.formatMessage(msg))
    if (redraw) self.neat.render()
  }

  var rs = self.cabal.readMessages(channel, {limit: MAX_MESSAGES})
  rs.on('data', function (msg) {
    onMessage(msg, false)

    // beep on mention
    var user = self.cabal.username
    if (msg.value) { msg = msg.value }
    if (!msg.type) { msg.type = 'chat/text' }
    if (msg.content && msg.author && 
        msg.type === 'chat/text' &&
        msg.content.indexOf(user) > -1 && 
        msg.author !== user) {
      process.stdout.write('\x07')  // beep character
     } 
  })
  rs.on('end', function () {
    self.neat.render()
    listenNewMessages()
  })

  function listenNewMessages (since) {
    self.cabal.listenMessages(channel, function (msg) {
      onMessage(msg, true)
      self.neat.render()
    })
  }
}

NeatScreen.prototype.render = function () {
  this.bus.emit('render')
}

NeatScreen.prototype.formatMessage = function (msg) {
  var self = this
  var highlight = false
  var user = self.cabal.username
  if (!msg.value.type) { msg.type = 'chat/text' }
  if (msg.value.content && msg.value.timestamp) {
    if (msg.value.content.text.indexOf(user) > -1 && msg.value.author !== user) { highlight = true }
    
    var author
    if (this.state.users && this.state.users[msg.key]) author = this.state.users[msg.key].name
    else author = msg.key.slice(0, 8)

    var timestamp = `${chalk.gray(formatTime(msg.value.timestamp))}`
    var authorText = `${chalk.gray('<')}${chalk.cyan(author)}${chalk.gray('>')}`
    var content = msg.value.content.text
    var emote = (msg.value.type === 'chat/emote')

    if (emote) {
      authorText = `${chalk.white(author)}`
      content = `${chalk.gray(msg.value.content)}`
    }

    return timestamp + (emote ? ' * ' : ' ') + (highlight ? chalk.bgRed(chalk.black(authorText)) : authorText) + ' ' + content
  }
  return chalk.cyan('unknown message type: ') + chalk.gray(JSON.stringify(msg.value))
}

function formatTime (t) {
  return strftime('%T', new Date(t))
}

module.exports = NeatScreen
