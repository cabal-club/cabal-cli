var chalk = require('chalk')
var Commander = require('./commands.js')
var neatLog = require('neat-log')
var strftime = require('strftime')
var views = require('./views')
var util = require('./util')
var Pager = require('./pager')
var debug = require("./debug")
var markdown = require('./markdown-shim')
var welcomeMessage = ['welcome to cabal', 
  'type /channels to see which channels to join, and /help for more commands', 
  'for more info visit https://github.com/cabal-club/cabal']

function NeatScreen (props) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(props)
  this.pager = new Pager({
    pagesize: this._pagesize.bind(this),
    startpoint: {ts: null, val: 'NULL'},
    endpoint: {ts: null, val: 'NULL'}
  })
  this.client = props.client
  this.commander = Commander(this, this.client)
  var self = this

  this.neat = neatLog(this.renderApp.bind(this), { fullscreen: true,
    style: function (start, cursor, end) {
      if (!cursor) cursor = ' '
      return start + chalk.underline(cursor) + end
    } }
  )
  this.neat.input.on('update', () => this.neat.render())
  this.neat.input.on('enter', (line) => this.commander.process(line))

  this.neat.input.on('tab', () => {
    var line = this.neat.input.rawLine()
    if (line.length > 1 && line[0] === '/') {
      // command completion
      var soFar = line.slice(1)
      var commands = Object.keys(this.commander.commands)
      var matchingCommands = commands.filter(cmd => cmd.startsWith(soFar))
      if (matchingCommands.length === 1) {
        this.neat.input.set('/' + matchingCommands[0])
      }
    } else {
      const cabalUsers = this.client.getUsers()
      // nick completion
      var users = Object.keys(cabalUsers)
        .map(key => cabalUsers[key])
        .map(user => user.name || user.key.substring(0, 8))
        .sort()
      var pattern = (/^(\w+)$/)
      var match = pattern.exec(line)

      if (match) {
        users = users.filter(user => user.startsWith(match[0]))
        if (users.length > 0) this.neat.input.set(users[0] + ': ')
      }
    }
  })

  this.neat.input.on('up', () => {
    if (this.commander.history.length) {
      var command = this.commander.history.pop()
      this.commander.history.unshift(command)
      this.neat.input.set(command)
    }
  })

  this.neat.input.on('down', () => {
    if (this.commander.history.length) {
      var command = this.commander.history.shift()
      this.commander.history.push(command)
      this.neat.input.set(command)
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

  // move between window panes with ctrl+j
  this.neat.input.on('alt-n', () => {
    var i = this.state.windowPanes.indexOf(this.state.selectedWindowPane)
    if (i !== -1) {
      i = ++i % this.state.windowPanes.length
      this.state.selectedWindowPane = this.state.windowPanes[i]
      this.bus.emit('render')
    }
  })

  // move up/down pane with ctrl+{n,p}
  this.neat.input.on('ctrl-p', () => {
    cycleCurrentPane.bind(this)(-1)
  })

  this.neat.input.on('ctrl-n', () => {
    cycleCurrentPane.bind(this)(1)
  })

  function cycleCurrentPane (dir) {
    var i
    if (this.state.selectedWindowPane === 'cabals') {
      i = this.state.cabals.findIndex((key) => key === this.state.cabal.key)
      i += dir * 1
      i = i % this.state.cabals.length
      if (i < 0) i += this.state.cabals.length
      setCabalByIndex.bind(this)(i)
    } else {
      var channels = this.state.cabal.getJoinedChannels()
      i = channels.indexOf(this.commander.channel)
      i += dir * 1
      i = i % channels.length
      if (i < 0) i += channels.length
      setChannelByIndex.bind(this)(i)
    }
  }

  function setCabalByIndex (n) {
    if (n < 0 || n >= this.state.cabals.length) return
    this.showCabal(this.state.cabals[n])
  }

  function setChannelByIndex (n) {
    var channels = self.state.cabal.getJoinedChannels()
    if (n < 0 || n >= channels.length) return
    self.commander.channel = channels[n]
    self.loadChannel(channels[n])
  }

  this.neat.input.on('ctrl-d', () => process.exit(0))
  this.neat.input.on('pageup', () => {
    var window = this.pager.pageup(this.state.oldest)
    this.state.window = window
    this.processMessages({ olderThan: window.start.ts }) 
  })

  this.neat.input.on('pagedown', () => {
    var window = this.pager.pagedown()
    this.state.window = window
    // we have -1 to window.start because we're using the window of messages we had last time.
    // so: if we try to get what's newer than the first message of the last chat window, we'll leave out that first
    // message!
    var opts = {}
    if (window.start.ts) opts.newerThan = window.start.ts - 1
    if (window.end.ts) opts.olderThan = window.end.ts 
    this.processMessages(opts) 
  })

  this.neat.use((state, bus) => {
    state.neat = this.neat
    this.bus = bus
    /* all state variables used in neat screen */
    state.messages = []
    state.topic = ''
    state.unreadChannels = {}
    state.mentions = {}
    state.hasScrollback = () => { return this.pager.paging }
    state.oldest = Date.now()
    state.selectedWindowPane = 'channels'
    state.windowPanes = [state.selectedWindowPane]
    this.state = state

    Object.defineProperty(this.state, 'cabal', {
      get: () => {
        return this.client.cabalToDetails()
      }
    })
    Object.defineProperty(this.state, 'cabals', {
      get: () => {
        return this.client.getCabalKeys()
      }
    })

    this.initializeCabalClient()
  })
}

NeatScreen.prototype._handleUpdate = function (updatedDetails) {
  this.state.cabal = updatedDetails
  var channels = this.client.getJoinedChannels()
  this.commander.channel = this.state.cabal.getCurrentChannel()
  this.state.windowPanes = this.state.cabals.length > 1 ? ['channels', 'cabals'] : ['channels']

  // reset cause we fill them up below
  this.state.unreadChannels = {}
  this.state.mentions = {}
  channels.forEach((ch) => {
    var unreads = this.client.getNumberUnreadMessages(ch)
    if (unreads > 0) { this.state.unreadChannels[ch] = unreads }
    var mentions = this.client.getMentions(ch)
    if (mentions.length > 0) { this.state.mentions[ch] = mentions }
  })
  this.state.topic = this.state.cabal.getTopic()
  var opts = {}
  if (this.state.window) {
    // we're grabbing an entire window
    if (this.state.window.end) {
      opts.newerThan = this.state.window.start.ts
      opts.olderThan = this.state.window.end.ts
      // we're not viewing a particular window, get everything that's older than the oldest
    } else {
      opts.olderThan = this.state.window.start.ts
    }
  }
  if (!this.pager.paging) { // only update view with messages if we're at the bottom i.e. not paging up
    this.processMessages(opts)
  }
  this.bus.emit('render')
  this.updateTimer = null
}

NeatScreen.prototype.initializeCabalClient = function () {
  var details = this.client.getCurrentCabal()
  this.state.cabal = details
  var counter = 0
  welcomeMessage.map((m) => this.client.addStatusMessage({ timestamp: Date.now() + counter++, text: m }))
  this.registerUpdateHandler(details)
  this.loadChannel('!status')
}

NeatScreen.prototype.registerUpdateHandler = function (cabal, oldCabal) {
  if (this._updateHandler) {
    // remove previous listener
    oldCabal.removeListener('update', this._updateHandler)
  }
  this._updateHandler = (updatedDetails) => {
    // insert timeout handler for to debounce events when tons are streaming in
    if (this.updateTimer) clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(() => {
      // update view
      this._handleUpdate(updatedDetails)
    }, 20)
  }
  // register an event handler for all updates from the cabal
  cabal.on('update', this._updateHandler)
}

NeatScreen.prototype._pagesize = function () {
  return views.getPageSize()
}

NeatScreen.prototype.processMessages = function (opts, cb) {
  opts = opts || {}
  if (!cb) cb = function () {}
    //console.error("opts.newerThan", opts.newerThan)
  opts.newerThan = opts.newerThan 
  opts.olderThan = opts.olderThan || Date.now()
  opts.amount = opts.amount || this._pagesize()
  // val is purely there for debugging, trust me it's v useful lol
  this.state.oldest = { ts: Date.now(), val: null }
  var unreadCount = this.client.getNumberUnreadMessages()

  this.client.getMessages({
    amount: opts.amount,
    olderThan: opts.olderThan,
    newerThan: opts.newerThan
  }, (msgs) => {
    this.state.timestamps = msgs.map((m) => m.value.timestamp).sort((a,b) => parseInt(a) - parseInt(b))
    //console.error("get messages older than", new Date(opts.olderThan), "and newer than", new Date(opts.newerThan))
    this.state.messages = []
    //debug.print("recv messages", debug.simplify(msgs), true)
    var pagedMessages = this.pager.page(msgs)
    //debug.print("paged messages", debug.simplify(pagedMessages), true)
    if (pagedMessages.length === 0) { this.bus.emit('render'); return } // basically only happens when we've started a new cabal
    pagedMessages.forEach((msg, i) => {
      this.state.messages.push(this.formatMessage(msg))
    })

    // crop messages to view
    this.state.messages = this.state.messages.slice(-this._pagesize())
    const val = pagedMessages[0].value
    const content = val.content
    this.state.oldest = { ts: val.timestamp, val:  content && content.text }
    this.neat.render()
    this.bus.emit('render')
    cb.bind(this)()
  })
}

NeatScreen.prototype.showCabal = function (cabal) {
  var oldCabal = this.state.cabal
  this.state.cabal = this.client.focusCabal(cabal)
  this.registerUpdateHandler(this.state.cabal, oldCabal)
  this.commander.cabal = this.state.cabal
  this.client.openChannel()
  this.pager.clear()
  this.bus.emit('render')
}

NeatScreen.prototype.renderApp = function (state) {
  var screen
  if (process.stdout.columns > 80) screen = views.big(state)
  else screen = views.small(state)
  // we don't need to adjust `state.messages` in the following cases
  if (state.croppedCount === 0 || this.pager._hitTopBoundary || !this.pager.paging ||  this.pager._dir === "down") return screen
  var index = this.state.croppedCount
  // adjust oldest using the index
  this.state.oldest = { ts: this.state.timestamps[index], val: null }
  // adjust neat screen's window
  if (this.state.window) {
    this.state.window.start = this.state.oldest
  }
  // adjust the last pushed window using the index
  var stackVal = this.pager.stack.pop()
  if (stackVal) {
    stackVal.start = this.state.oldest
    this.pager.stack.push(stackVal)
  }
  // adjust the displayed page using pager's cache
  var pageSlice = this.state.messages.slice(index)
  var cacheSlice = this.pager.cache.slice(-index)
  this.state.messages = pageSlice.concat(cacheSlice)

  return screen
}

// use to write anything else to the screen, e.g. info iessages or emotes
NeatScreen.prototype.writeLine = function (line, timestamp) {
  this.client.addStatusMessage({ timestamp: timestamp || Date.now(), text: line })
  this.bus.emit('render')
}

NeatScreen.prototype.clear = function () {
  this.state.messages = []
  this.bus.emit('render')
}

NeatScreen.prototype.setPane = function (pane) {
    this.state.selectedWindowPane = pane
    this.bus.emit("render")
}

NeatScreen.prototype.loadChannel = function (channel) {
  this.client.openChannel(channel)

    //console.error("-".repeat(30))
    //console.error("open", channel)
  // clear the old channel state
  this.pager.clear()
  this.state.messages = []
  this.state.window = null
  this.state.topic = ''
  this.processMessages()
  // load the topic
  this.state.topic = this.state.cabal.getTopic()
}

NeatScreen.prototype.render = function () {
  this.bus.emit('render')
}

NeatScreen.prototype.formatMessage = function (msg) {
  var highlight = false
  /*
   msg = {
     key: ''
     value: {
       timestamp: ''
       type: ''
       content: {
         text: ''
       }
     }
   }
   */
  if (!msg.value.type) { msg.value.type = 'chat/text' }
  if (msg.value.type === "status/date-changed") {
    return `${chalk.dim('day changed to ' + strftime('%e %b %Y', new Date(msg.value.timestamp)))}`
  }
  if (msg.value.content && msg.value.timestamp) {
    const users = this.client.getUsers()
    const authorSource = users[msg.key] || msg

    const author = authorSource.name || authorSource.key.slice(0, 8)
    var localNick = 'uninitialized'
    if (this.state) { localNick = this.state.cabal.getLocalName() }
    /* sanitize input to prevent interface from breaking */
    var msgtxt = msg.value.content.text
    if (msg.value.type !== 'status') {
      msgtxt = util.sanitizeString(msgtxt)
    }

    if (localNick.length > 0 && msgtxt.indexOf(localNick) > -1 && author !== localNick) { highlight = true }

    var color = keyToColour(msg.key) || colours[5]

    var timestamp = `${chalk.dim(formatTime(msg.value.timestamp))}`
    var authorText = `${chalk.dim('<')}${highlight ? chalk.whiteBright(author) : chalk[color](author)}${chalk.dim('>')}`
    if (msg.value.type === "status") {
      highlight = false // never highlight from status
      authorText = `${chalk.dim('-')}${highlight ? chalk.whiteBright(author) : chalk.cyan("status")}${chalk.dim('-')}`
    }
    var content = markdown(msgtxt)

    var emote = (msg.value.type === 'chat/emote')

    if (emote) {
      authorText = `${chalk.white(author)}`
      content = `${chalk.dim(msgtxt)}`
    }

    if (msg.value.type === 'chat/topic') {
      content = `${chalk.dim(`* sets the topic to ${chalk.cyan(msgtxt)}`)}`
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
