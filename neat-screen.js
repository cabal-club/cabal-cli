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
    draw(screen, renderTitlebar(state), 0, 0)

    // channels pane
    draw(screen, renderChannels(state, 16, process.stdout.rows - HEADER_ROWS), 0, 3)

    // chat messages
    draw(screen, renderMessages(state, process.stdout.columns - 17 - 17, process.stdout.rows - HEADER_ROWS), 18, 3)

    // nicks pane
    draw(screen, renderNicks(state, 16, process.stdout.rows - HEADER_ROWS), process.stdout.columns - 15, 3)

    // vertical dividers
    draw(screen, renderVerticalLine('|', process.stdout.rows - 6), 16, 3)
    draw(screen, renderVerticalLine('|', process.stdout.rows - 6), process.stdout.columns - 17, 3)

    // user input prompt
    draw(screen, renderPrompt(state), 18, process.stdout.rows - 2)

    return output(screen.join('\n'))
  }
}

function renderPrompt (state) {
  return [
    `${chalk.cyan(state.cabal.username)}:${state.channel}] ${state.neat.input.line()}`
  ]
}

function renderTitlebar (state) {
  return [
    chalk.gray('Cabal'),
    `dat://${state.cabal.db.key.toString('hex')}`
  ]
}

// Applies 'lines' to 'screen' at coordinates x/y
function draw (screen, lines, x, y) {
  // add any extra needed lines
  var extraLinesNeeded = (y + lines.length) - screen.length
  if (extraLinesNeeded > 0) {
    screen.push.apply(screen, new Array(extraLinesNeeded).fill(''))
  }

  // patch lines
  for (var i=y; i < y + lines.length; i++) {
    screen[i] = mergeString(screen[i], lines[i - y], x)
  }
}

// String, String -> String
function mergeString (src, string, x) {
  var res = src
  var extraCharsNeeded = (x + strlenAnsi(string)) - strlenAnsi(src)
  if (extraCharsNeeded > 0) {
    res += (new Array(extraCharsNeeded).fill(' ')).join('')
  }

  return sliceAnsi(res, 0, x) + string + sliceAnsi(res, x + strlenAnsi(string))
}

// Like String#slice, but taking ANSI codes into account
function sliceAnsi (str, from, to) {
  var len = 0
  var insideCode = false
  var res = ''
  to = (to === undefined) ? str.length : to

  for (var i=0; i < str.length; i++) {
    var chr = str.charAt(i)
    if (chr === '\033') insideCode = true
    if (!insideCode) len++
    if (chr === 'm' && insideCode) insideCode = false

    if (len > from && len <= to) {
      res += chr
    }
  }

  return res
}

// Length of 'str' sans ANSI codes
function strlenAnsi (str) {
  var len = 0
  var insideCode = false

  for (var i=0; i < str.length; i++) {
    var chr = str.charAt(i)
    if (chr === '\033') insideCode = true
    if (!insideCode) len++
    if (chr === 'm' && insideCode) insideCode = false
  }

  return len
}

function renderChannels (state, width, height) {
  return [state.channel]
  //state.cabal.getChannels((err, channels) => {
  //  if (err) return
  //  self.view.writeLine('* channels:')
  //  channels.map((m) => {
  //    self.view.writeLine.bind(self.view)(`  ${m}`)
  //  })
  //})
}

function renderVerticalLine (chr, height) {
  return new Array(height).fill(chr)
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
      accum.push.apply(accum, wrapAnsi(msg, width))
      return accum
    }, [])

  if (lines.length < height) {
    lines = lines.concat(Array(height - lines.length).fill())
  } else {
    lines = lines.slice(lines.length - height, lines.length)
  }

  return lines
}

// Apply whitespace to move a string right and/or down
// String, Int, Int -> String
function offset (text, x, y) {
  // Pad left
  var lines = text.split('\n')
    .map(function (line) {
      return (new Array(x).fill(' ').join('')) + line
    })

  // Pad top
  lines = (new Array(y).fill()).concat(lines)

  return lines.join('\n')
}

// Character-wrap text containing ANSI escape codes.
// String, Int -> [String]
function wrapAnsi (text, width) {
  if (!text) return []

  var res = []

  var line = []
  var lineLen = 0
  var insideCode = false
  for (var i=0; i < text.length; i++) {
    var chr = text.charAt(i)
    if (chr === '\033') {
      insideCode = true
    }

    line.push(chr)

    if (!insideCode) {
      lineLen++
      if (lineLen >= width - 1) {
        res.push(line.join(''))
        line = []
        lineLen = 0
      }
    }

    if (chr === 'm' && insideCode) {
      insideCode = false
    }
  }

  if (line.length > 0) {
    res.push(line.join(''))
  }

  return res
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
