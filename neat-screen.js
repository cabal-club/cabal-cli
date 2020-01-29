var chalk = require('chalk')
var Commander = require('./commands.js')
var neatLog = require('neat-log')
var strftime = require('strftime')
var views = require('./views')
var util = require('./util')
var markdown = require('./markdown-shim')
var welcomeMessage = ['welcome to cabal',
  'type /channels to see which channels to join, and /help for more commands',
  'for more info visit https://github.com/cabal-club/cabal']

function NeatScreen (props) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(props)
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
      const users = Object.keys(cabalUsers)
        .map(key => cabalUsers[key])
        .map(user => user.name || user.key.substring(0, 8))
        .sort()
      let match = line.trim().split(/\s+/g).slice(-1)[0] // usual case is we want to autocomplete the last word on a line

      const cursor = this.neat.input.cursor
      let lindex = -1
      let rindex = -1
      // cursorWandering === true => we're trying to autocomplete something in the middle of the line; i.e the cursor has wandered away from the end
      const cursorWandering = cursor !== line.length
      if (cursorWandering) {
        // find left-most boundary of potential nickname fragment to autocomplete
        for (let i = cursor - 1; i >= 0; i--) {
          if (line.charAt(i) === ' ' || i === 0) {
            lindex = i
            break
          }
        }
        // find right-most boundary of nickname
        for (let i = cursor; i <= line.length; i++) {
          if (line.charAt(i) === ' ') {
            rindex = i
            break
          }
        }
        match = line.slice(lindex, rindex).trim()
      }
      if (!match) { return }

      // determine if we are tabbing through alternatives of similar-starting nicks
      let cyclingNicks = false
      if (this.state.prevCompletion !== undefined && match.toLowerCase().startsWith(this.state.prevCompletion.toLowerCase())) {
        // use the original word we typed before tab-completing it
        match = this.state.prevCompletion
        cyclingNicks = true
      } else {
        delete this.state.prevCompletion
        delete this.state.prevNickIndex
      }

      // proceed to figure out the closest match
      const filteredUsers = Array.from(new Set(users.filter(user => user.toLowerCase().startsWith(match.toLowerCase())))) // filter out duplicate nicks
      if (filteredUsers.length > 0) {
        const userIndex = cyclingNicks ? (this.state.prevNickIndex + 1) % filteredUsers.length : 0
        const filteredUser = filteredUsers[userIndex]
        const currentInput = this.neat.input.rawLine()
        let completedInput = currentInput.slice(0, currentInput.length - match.length) + filteredUser
        // i.e. repeated tabbing of similar-starting nicks
        if (cyclingNicks) { 
          let prevNick = filteredUsers[this.state.prevNickIndex]
          // we autocompleted a single nick w/ colon+space added, adjust for colon+space
          if (currentInput.length === prevNick.length + 2) { prevNick += ": " } 
          completedInput = currentInput.slice(0, currentInput.length - prevNick.length) + filteredUser
        }
        // i.e. cursor has been moved from end of line
        if (cursorWandering) {
          completedInput = (lindex > 0) ? currentInput.slice(0, lindex + 1) : ""
          completedInput += filteredUser + currentInput.slice(rindex)
        }
        // ux: we only autcompleted a single nick, add a colon and space
        if (completedInput === filteredUser) { 
          completedInput += ': ' 
        } 
        this.neat.input.set(completedInput) // update the input line with our newly tab-completed nick
        // when neat-input.set() is used the cursor is automatically moved to the end of the line, 
        // if the cursor is wandering we instead want the cursor to be just after the autocompleted name
        if (cursorWandering) {
          this.neat.input.cursor = cursor + (filteredUser.length - currentInput.slice(lindex, rindex).trim().length)
        }
        this.state.prevCompletion = match
        this.state.prevNickIndex = userIndex
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
    // clear state for nick autocompletion if something other than tab has been pressed
    else if (key.name !== 'tab' && this.state.prevCompletion) {
      delete this.state.prevCompletion
      delete this.state.prevNickIndex
    } else {
      return
    }
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
  this.neat.input.on('pageup', () => { this.state.scrollback++ })
  this.neat.input.on('pagedown', () => { this.state.scrollback = Math.max(0, this.state.scrollback - 1) })

  this.neat.use((state, bus) => {
    state.neat = this.neat
    this.bus = bus
    /* all state variables used in neat screen */
    state.messages = []
    state.topic = ''
    state.unreadChannels = {}
    state.mentions = {}
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
  if (updatedDetails && updatedDetails.key !== this.client.getCurrentCabal().key) {
    // an unfocused cabal sent an update, don't render its changes
    return
  }
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
  if (!this.scrollback > 0) { // only update view with messages if we're at the bottom i.e. not paging up
    this.processMessages(opts)
  }
  this.bus.emit('render')
  this.updateTimer = null
}

NeatScreen.prototype.initializeCabalClient = function () {
  var details = this.client.getCurrentCabal()
  this.state.cabal = details
  this.state.scrollback = 0
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
  opts.newerThan = opts.newerThan || null
  opts.olderThan = opts.olderThan || Date.now()
  opts.amount = opts.amount || this._pagesize() * 2.5

  // var unreadCount = this.client.getNumberUnreadMessages()
  this.client.getMessages(opts, (msgs) => {
    this.state.messages = []
    msgs.forEach((msg, i) => {
      this.state.messages.push(this.formatMessage(msg))
    })
    this.bus.emit('render')
    cb.bind(this)()
  })
}

NeatScreen.prototype.showCabal = function (cabal) {
  var oldCabal = this.state.cabal
  this.state.cabal = this.client.focusCabal(cabal)
  this.registerUpdateHandler(this.state.cabal, oldCabal)
  this.commander.cabal = this.state.cabal
  this.client.focusChannel()
  this.bus.emit('render')
}

NeatScreen.prototype.renderApp = function (state) {
  if (process.stdout.columns > 80) return views.big(state)
  else return views.small(state)
}

// use to write anything else to the screen, e.g. info messages or emotes
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
  this.bus.emit('render')
}

NeatScreen.prototype.loadChannel = function (channel) {
  this.client.focusChannel(channel)
  // clear the old channel state
  this.state.messages = []
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
  /* legend for `msg` below
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
  // virtual message type, handled by cabal-client
  if (msg.value.type === 'status/date-changed') {
    return {
      formatted: `${chalk.dim('day changed to ' + strftime('%e %b %Y', new Date(msg.value.timestamp)))}`,
      raw: msg
    }
  }
  if (msg.value.content && msg.value.timestamp) {
    const users = this.client.getUsers()
    const authorSource = users[msg.key] || msg

    const author = authorSource.name || authorSource.key.slice(0, 8)
    // add author field for later use in calculating the left-padding of multi-line messages
    msg.author = author
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
    if (msg.value.type === 'status') {
      highlight = false // never highlight from status
      authorText = `${chalk.dim('-')}${highlight ? chalk.whiteBright(author) : chalk.cyan('status')}${chalk.dim('-')}`
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

    return {
      formatted: timestamp + (emote ? ' * ' : ' ') + (highlight ? chalk.bgRed(chalk.black(authorText)) : authorText) + ' ' + content,
      raw: msg
    }
  }
  return {
    formatted: chalk.cyan('unknown message type: ') + chalk.inverse(JSON.stringify(msg.value)),
    raw: msg
  }
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
  // 'blue',
  'magenta',
  'cyan',
  // 'white',
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
