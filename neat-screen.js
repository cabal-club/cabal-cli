var neatLog = require('neat-log')
var chalk = require('chalk')
var strftime = require('strftime')
var Commander = require('./commands.js')
var views = require('./views')

// TODO:
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
    var line = self.neat.input.rawLine()
    if (line.length > 1 && line[0] === '/') {
      // command completion
      var soFar = line.slice(1)
      var commands = Object.keys(this.commander.commands)
      var matchingCommands = commands.filter(cmd => cmd.startsWith(soFar))
      if (matchingCommands.length == 1) {
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
    var currentIdx = self.state.cabal.channels.indexOf(self.commander.channel)
    if (currentIdx !== -1) {
      currentIdx--
      if (currentIdx < 0) currentIdx = self.state.cabal.channels.length - 1
      setChannelByIndex(currentIdx)
    }
  })
  this.neat.input.on('ctrl-n', () => {
    var currentIdx = self.state.cabal.channels.indexOf(self.commander.channel)
    if (currentIdx !== -1) {
      currentIdx++
      currentIdx = currentIdx % self.state.cabal.channels.length
      setChannelByIndex(currentIdx)
    }
  })

  function setChannelByIndex (n) {
    if (n < 0 || n >= self.state.cabal.channels.length) return

    self.commander.channel = self.state.cabal.channels[n]
    self.loadChannel(self.state.cabal.channels[n])
  }

  this.neat.input.on('ctrl-u', () => self.neat.input.set(''))
  this.neat.input.on('ctrl-d', () => process.exit(0))
  this.neat.input.on('ctrl-w', () => {
    const line = this.neat.input.rawLine()
    const beforeCursor = line.substring(0, this.neat.input.cursor).replace(/\s*$/, '')
    const afterCursor = line.substring(this.neat.input.cursor)
    const prunedStart = beforeCursor.split(' ').slice(0, -1).join(' ')
    const prunedWithSpace = prunedStart + (prunedStart.length > 0 ? ' ' : '')
    this.neat.input.set(prunedWithSpace + afterCursor)
    this.neat.input.cursor = prunedWithSpace.length
  })
  this.neat.input.on('pageup', () => self.state.scrollback++)
  this.neat.input.on('pagedown', () => self.state.scrollback = Math.max(0, self.state.scrollback - 1))

  this.neat.use(function (state, bus) {
    state.cabal = cabal
    state.neat = self.neat

    self.state = state
    self.bus = bus

    self.state.cabal.getChannels((err, channels) => {
      if (err) return
      self.state.cabal.channels = channels
      // load initial state of the channel
      self.loadChannel('default')
    })
  })
  // self.cabal.on('join', (username) => {
  //   self.writeLine(`* ${username} joined`)
  // })
  //
  // self.cabal.on('leave', (username) => {
  //   self.writeLine(`* ${username} left`)
  // })

  function view (state) {
    if (process.stdout.columns > 80) return views.big(state)
    else return views.small(state)
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
  self.state.cabal.joinChannel(channel)
  self.state.scrollback = 0;
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
  if (!msg.type) { msg.type = 'chat/text' }
  if (msg.content && msg.author && msg.time) {
    if (msg.content.indexOf(user) > -1 && msg.author !== user) { hilight = true }

    var timestamp = `${chalk.gray(formatTime(msg.time))}`
    var authorText = `${chalk.gray('<')}${chalk.cyan(msg.author)}${chalk.gray('>')}`
    var content = msg.content
    var emote = (msg.type === 'chat/emote')

    if (emote) {
      authorText = `${chalk.white(msg.author)}`
      content = `${chalk.gray(msg.content)}`
    }

    return timestamp + (emote ? ' * ' : ' ') + (hilight ? chalk.bgRed(chalk.black(authorText)) : authorText) + ' ' + content
  }
  return chalk.cyan('unknown message type: ') + chalk.gray(JSON.stringify(msg))
}

function formatTime (t) {
  return strftime('%T', new Date(t))
}

module.exports = NeatScreen
