var neatLog = require('neat-log')
var output = require('./output')
var strftime = require('strftime')
var Commander = require('./commands.js')
var chalk = require('chalk')
var blit = require('txt-blit')
var util = require('./util')

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

  // move up/down channels with ctrl+{n,p}
  this.neat.input.on('ctrl-p', () => {
    var currentIdx = self.channels.indexOf(self.commander.channel)
    if (currentIdx !== -1) {
      currentIdx--
      if (currentIdx < 0) currentIdx = self.channels.length - 1
      setChannelByIndex(currentIdx)
    }
  })
  this.neat.input.on('ctrl-n', () => {
    var currentIdx = self.channels.indexOf(self.commander.channel)
    if (currentIdx !== -1) {
      currentIdx++
      currentIdx = currentIdx % self.channels.length
      setChannelByIndex(currentIdx)
    }
  })

  function setChannelByIndex (n) {
    if (n < 0 || n >= self.channels.length) return

    self.commander.channel = self.channels[n]
    self.loadChannel(self.channels[n])
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

  this.neat.use(function (state, bus) {
    state.cabal = cabal
    state.neat = self.neat

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
    var screen = []

    // title bar
    blit(screen, renderTitlebar(state, process.stdout.columns), 0, 0)

    // channels pane
    blit(screen, renderChannels(state, 16, process.stdout.rows - HEADER_ROWS), 0, 3)

    // chat messages
    blit(screen, renderMessages(state, process.stdout.columns - 17 - 17, process.stdout.rows - HEADER_ROWS), 18, 3)

    // nicks pane
    blit(screen, renderNicks(state, 16, process.stdout.rows - HEADER_ROWS), process.stdout.columns - 15, 3)

    // vertical dividers
    blit(screen, renderVerticalLine('|', process.stdout.rows - 6, chalk.blue), 16, 3)
    blit(screen, renderVerticalLine('|', process.stdout.rows - 6, chalk.blue), process.stdout.columns - 17, 3)

    // horizontal dividers
    blit(screen, renderHorizontalLine('-', process.stdout.columns, chalk.blue), 0, process.stdout.rows - 3)
    blit(screen, renderHorizontalLine('-', process.stdout.columns, chalk.blue), 0, 2)

    // user input prompt
    blit(screen, renderPrompt(state), 0, process.stdout.rows - 2)

    return output(screen.join('\n'))
  }
}

function renderPrompt (state) {
  return [
    `[${chalk.cyan(state.cabal.username)}:${state.channel}] ${state.neat.input.line()}`
  ]
}

function renderTitlebar (state, width) {
  return [
    chalk.bgBlue(util.centerText(chalk.white.bold('CABAL'), width)),
    util.rightAlignText(chalk.white(`dat://${state.cabal.db.key.toString('hex')}`), width)
  ]
}

function renderChannels (state, width, height) {
  return state.channels
    .map(function (channel, idx) {
      if (state.channel === channel) {
        return ' ' + chalk.bgBlue((idx + 1) + '. ' + channel)
      } else {
        return ' ' + chalk.gray((idx + 1) + '. ') + chalk.white(channel)
      }
    })
}

function renderVerticalLine (chr, height, chlk) {
  return new Array(height).fill(chlk ? chlk(chr) : chr)
}

function renderHorizontalLine (chr, width, chlk) {
  var txt = new Array(width).fill(chr).join('')
  if (chlk) txt = chlk(txt)
  return [txt]
}

function renderNicks (state, width, height) {
  var users = Object.keys(state.cabal.users)
    .map(function (username) {
      return username.slice(0, width)
    })
  return users
}

function renderMessages (state, width, height) {
  var msgs = state.messages

  // Character-wrap to area edge
  var lines = msgs.reduce(function (accum, msg) {
    accum.push.apply(accum, util.wrapAnsi(msg, width))
    return accum
  }, [])

  if (lines.length < height) {
    lines = lines.concat(Array(height - lines.length).fill(''))
  } else {
    lines = lines.slice(lines.length - height, lines.length)
  }

  return lines
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

  // HACK: we can do better than this!
  self.channels = []

  self.state.channels = []
  self.state.cabal.getChannels((err, channels) => {
    if (err) return
    self.state.channels = channels
    self.channels = channels
    self.bus.emit('render')
  })
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

    if (msg.type === 'chat/emote') {
      authorText = `${chalk.cyan(msg.author)}`
    }

    return timestamp + ' ' + (hilight ? chalk.bgRed(chalk.black(authorText)) : authorText) + ' ' + msg.content
  }
  return chalk.cyan('unknown message type: ') + chalk.gray(JSON.stringify(msg))
}

function formatTime (t) {
  return strftime('%T', new Date(t))
}

module.exports = NeatScreen
