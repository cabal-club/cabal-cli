var neatLog = require('neat-log')
var chalk = require('chalk')
var strftime = require('strftime')
var Commander = require('./commands.js')
var views = require('./views')
var collect = require('collect-stream')

const HEADER_ROWS = 6

function NeatScreen (cabal) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(cabal)
  var self = this

  this.cabal = cabal
  this.commander = Commander(this, cabal)

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
      var users = Object.keys(self.state.users)
        .map(key => self.state.users[key])
        .map(user => user.name || user.key.substring(0, 8))
        .sort()
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

  this.neat.input.on('ctrl-d', () => process.exit(0))
  this.neat.input.on('pageup', () => self.state.scrollback++)
  this.neat.input.on('pagedown', () => { self.state.scrollback = Math.max(0, self.state.scrollback - 1); return null })

  this.neat.use(function (state, bus) {
    state.cabal = cabal
    state.neat = self.neat

    self.state = state
    self.bus = bus

    self.state.messages = []
    self.state.channels = []
    self.state.users = {}
    self.state.user = null

    self.cabal.on('peer-added', function (key) {
      var found = false
      Object.keys(self.state.users).forEach(function (k) {
        if (k === key) {
          self.state.users[k].online = true
          found = true
        }
      })
      if (!found) {
        self.state.users[key] = {
          key: key,
          online: true
        }
      }
      self.bus.emit('render')
    })
    self.cabal.on('peer-dropped', function (key) {
      Object.keys(self.state.users).forEach(function (k) {
        if (k === key) {
          self.state.users[k].online = false
          self.bus.emit('render')
        }
      })
    })

    // TODO: use cabal-core api for all of this
    self.cabal.db.ready(function () {
      self.cabal.channels.get((err, channels) => {
        if (err) return
        self.state.channels = channels
        self.loadChannel('default')
        self.bus.emit('render')

        self.cabal.channels.events.on('add', function (channel) {
          self.state.channels.push(channel)
          self.state.channels.sort()
          self.bus.emit('render')
        })

        self.cabal.topics.events.on('update', function (msg) {
          self.state.topic = msg.value.content.topic
          self.bus.emit('render')
        })
      })

      self.cabal.users.getAll(function (err, users) {
        if (err) return
        state.users = users

        updateLocalKey()

        self.cabal.users.events.on('update', function (key) {
          // TODO: rate-limit
          self.cabal.users.get(key, function (err, user) {
            if (err) return
            state.users[key] = Object.assign(state.users[key] || {}, user)
            if (self.state.user && key === self.state.user.key) self.state.user = state.users[key]
            if (!self.state.user) updateLocalKey()
            self.bus.emit('render')
          })
        })

        function updateLocalKey () {
          self.cabal.getLocalKey(function (err, lkey) {
            if (err) return self.bus.emit('render')
            Object.keys(users).forEach(function (key) {
              if (key === lkey) {
                self.state.user = users[key]
                self.state.user.local = true
                self.state.user.online = true
                self.state.user.key = key
              }
            })
            self.bus.emit('render')
          })
        }
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
  this.state.messages.push(`${chalk.dim(line)}`)
  this.bus.emit('render')
}

NeatScreen.prototype.clear = function () {
  this.state.messages = []
  this.bus.emit('render')
}

NeatScreen.prototype.loadChannel = function (channel) {
  if (this.state.msgListener) {
    this.cabal.messages.events.removeListener(this.state.channel, this.state.msgListener)
    this.state.msgListener = null
  }

  var self = this

  // This is really cheap, so we could load many more if we wanted to!
  var MAX_MESSAGES = process.stdout.rows - HEADER_ROWS + 50

  self.state.channel = channel

  // clear the old channel state
  self.state.scrollback = 0
  self.state.messages = []
  self.state.topic = ''
  self.neat.render()

  // MISSING: mention beeps
  // MISSING: day change messages

  var pending = 0
  function onMessage () {
    if (pending > 0) {
      pending++
      return
    }
    pending = 1

    // TODO: wrap this up in a nice interface and expose it via cabal-client
    var rs = self.cabal.messages.read(channel, {limit: MAX_MESSAGES, lt: '~'})
    collect(rs, function (err, msgs) {
      if (err) return
      msgs.reverse()

      self.state.messages = []

      msgs.forEach(function (msg) {
        self.state.messages.push(self.formatMessage(msg))
      })

      self.neat.render()

      self.cabal.topics.get(channel, (err, topic) => {
        if (err) return
        if (topic) {
          self.state.topic = topic
          self.neat.render()
        }
      })

      if (pending > 1) {
        pending = 0
        onMessage()
      } else {
        pending = 0
      }
    })
  }

  self.cabal.messages.events.on(channel, onMessage)
  self.state.msgListener = onMessage

  onMessage()
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
    if (this.state.users && this.state.users[msg.key]) author = this.state.users[msg.key].name || this.state.users[msg.key].key.slice(0, 8)
    else author = msg.key.slice(0, 8)

    var color = keyToColour(msg.key)

    var timestamp = `${chalk.dim(formatTime(msg.value.timestamp))}`
    var authorText = `${chalk.dim('<')}${chalk[color](author)}${chalk.dim('>')}`
    var content = msg.value.content.text
    var emote = (msg.value.type === 'chat/emote')

    if (emote) {
      authorText = `${chalk.white(author)}`
      content = `${chalk.dim(msg.value.content.text)}`
    }
    if (msg.value.type === 'chat/topic') {
      content = `${chalk.gray(`* ${self.state.channel} MOTD: ${msg.value.content.text}`)}`
    }

    return timestamp + (emote ? ' * ' : ' ') + (highlight ? chalk.bgRed(chalk.black(authorText)) : authorText) + ' ' + content
  }
  return chalk.cyan('unknown message type: ') + chalk.inverse(JSON.stringify(msg.value))
}

function formatTime (t) {
  return strftime('%T', new Date(t))
}

function keyToColour (key) {
  var n = 0
  for (var i = 0; i < key.length; i++) {
    n += parseInt(key[i], 16)
    n = n % colours.length
  }
  return colours[n]
}

var colours = [
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  // 'gray',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright'
]

module.exports = NeatScreen
