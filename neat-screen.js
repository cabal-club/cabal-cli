var chalk = require('chalk')
var Commander = require('./commands.js')
var neatLog = require('neat-log')
var strftime = require('strftime')
var views = require('./views')
var util = require('./util')
var markdown = require('./markdown-shim')
var fs = require('fs')
var path = require('path')
var welcomePath = path.join(__dirname, 'welcome.txt')
var welcomeMessage = fs.readFileSync(welcomePath).toString().split('\n')

function NeatScreen (props) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(props)
  this.client = props.client
  this.config = props.frontendConfig
  this.commander = Commander(this, this.client)
  this.lastInputTime = 0
  this.inputTimer = null
  this.BACKLOG_BATCH = 250
  this.additionalBacklog = 0
  var self = this

  this.neat = neatLog(this.renderApp.bind(this), {
    fullscreen: true,
    style: function (start, cursor, end) {
      if (!cursor) cursor = ' '
      return start + chalk.underline(cursor) + end
    }
  }
  )
  this.neat.input.on('update', () => {
    // debounce keyboard input events so pasting from clipboard is fast
    var now = Date.now()
    var ms = 20
    if (this.inputTimer) {
    } else if (now > this.lastInputTime + ms) {
      this.lastInputTime = now
      this.neat.render()
    } else {
      this.inputTimer = setTimeout(() => {
        this.inputTimer = null
        this.neat.render()
      }, ms)
    }
  })
  this.neat.input.on('enter', (line) => this.commander.process(line))

  // welcome to autocomplete town
  this.neat.input.on('tab', () => {
    var line = this.neat.input.rawLine()
    if (line.length > 1 && line[0] === '/') {
      const parts = line.split(/\s+/g)
      // command completion
      if (parts.length === 1) {
        var soFar = line.slice(1)
        var commands = Object.keys(this.client.getCommands())
        var matchingCommands = commands.filter(cmd => cmd.startsWith(soFar))
        if (matchingCommands.length === 1) {
          this.neat.input.set('/' + matchingCommands[0])
        }
        // argument completion
      } else if (parts.length === 2) {
        const command = parts[0].slice(1)
        // we only have channel completion atm: return if command is unrelated to channels
        if (!['leave', 'l', 'join', 'j'].includes(command)) { return }
        // channel completion
        let channelFragment = parts[1].trim()
        if (this.state.prevChannelFragment && channelFragment.startsWith(this.state.prevChannelFragment)) {
          channelFragment = this.state.prevChannelFragment
        } else {
          // clear up old state
          delete this.state.prevChannelFragment
          delete this.state.prevChannelId
        }
        const channels = this.state.cabal.getChannels()
        const matches = channels.filter(ch => ch.startsWith(channelFragment))
        if (matches.length === 0) { return }
        const chid = this.state.prevChannelId !== undefined ? (this.state.prevChannelId + 1) % matches.length : 0
        const channelMatch = matches[chid]
        this.neat.input.set(`${parts[0]} ${channelMatch}`)
        this.state.prevChannelId = chid
        this.state.prevChannelFragment = channelFragment
      }
    } else {
      const cabalUsers = this.client.getUsers()
      // nick completion
      const users = Object.keys(cabalUsers)
        .map(key => cabalUsers[key])
        .sort(util.cmpUser)
        .map(user => user.name || user.key.substring(0, 8))
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
      const filteredUsers = Array.from(new Set(users.filter(user => user.search(/\s+/) === -1 && user.toLowerCase().startsWith(match.toLowerCase())))) // filter out duplicate nicks and people with spaces in their nicks, fuck that
      if (filteredUsers.length > 0) {
        const userIndex = cyclingNicks ? (this.state.prevNickIndex + 1) % filteredUsers.length : 0
        const filteredUser = filteredUsers[userIndex]
        const currentInput = this.neat.input.rawLine()
        let completedInput = currentInput.slice(0, currentInput.length - match.length) + filteredUser
        // i.e. repeated tabbing of similar-starting nicks
        if (cyclingNicks) {
          let prevNick = filteredUsers[this.state.prevNickIndex]
          // we autocompleted a single nick w/ colon+space added, adjust for colon+space
          if (currentInput.length === prevNick.length + 2) { prevNick += ': ' }
          completedInput = currentInput.slice(0, currentInput.length - prevNick.length) + filteredUser
        }
        // i.e. cursor has been moved from end of line
        if (cursorWandering) {
          completedInput = (lindex > 0) ? currentInput.slice(0, lindex + 1) : ''
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
    var i = Math.min(this.commander.history.length - 1, this.commander.historyIndex + 1)
    var j = this.commander.history.length - 1 - i
    if (j >= 0 && j < this.commander.history.length) {
      this.commander.historyIndex = i
      var command = this.commander.history[j]
      this.neat.input.set(command)
    }
  })

  this.neat.input.on('down', () => {
    var len = this.commander.history.length
    var i = Math.max(-1, this.commander.historyIndex - 1)
    this.commander.historyIndex = i
    if (i < 0) {
      var line = this.neat.input.rawLine()
      if (line.length > 0 && line !== this.commander.history[len - 1]) {
        this.commander.history.push(line)
      }
      this.neat.input.set('')
    } else {
      var command = this.commander.history[len - 1 - i]
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
  this.neat.input.on('alt-l', () => { this.commander.process('/ids') })

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

  // redraw the screen
  this.neat.input.on('ctrl-l', () => {
    this.neat.clear()
  })

  // cycle to next unread channel
  this.neat.input.on('ctrl-r', () => {
    // prioritize channels with mentions. after all those are exhausted, continue to unread channels
    const channels = Array.from(new Set(Object.keys(this.state.mentions).concat(Object.keys(this.state.unreadChannels))))
    channels.sort()
    if (channels.length === 0) return
    this.loadChannel(channels[0])
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
      var channels = this.state.cabal.getChannels({ includePM: true, onlyJoined: true })
      i = channels.indexOf(this.state.cabal.getCurrentChannel())
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
    var channels = self.state.cabal.getChannels({ includePM: true, onlyJoined: true })
    if (n < 0 || n >= channels.length) return
    self.loadChannel(channels[n])
  }

  const scrollOffset = 11
  this.neat.input.on('pageup', () => {
    this.state.messageScrollback += process.stdout.rows - scrollOffset
  })
  this.neat.input.on('pagedown', () => {
    this.state.messageScrollback = Math.max(0, this.state.messageScrollback - (process.stdout.rows - scrollOffset))
  })
  this.neat.input.on('shift-pageup', () => {
    this.state.userScrollback = Math.max(0, this.state.userScrollback - (process.stdout.rows - 9))
  })
  this.neat.input.on('shift-pagedown', () => {
    this.state.userScrollback += process.stdout.rows - 9
  })

  this.neat.use((state, bus) => {
    state.neat = this.neat
    this.bus = bus
    /* all state variables used in neat screen */
    state.messages = []
    state.topic = ''
    state.unreadChannels = {}
    state.mentions = {}
    state.moderationKeys = []
    state.selectedWindowPane = 'channels'
    state.windowPanes = [state.selectedWindowPane]
    state.config = this.config
    state.messageTimeLength = strftime(this.config.messageTimeformat, new Date()).length
    state.collision = {}
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
  this.state.windowPanes = this.state.cabals.length > 1 ? ['channels', 'cabals'] : ['channels']
  this._updateCollisions()
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
  if (!this.messageScrollback > 0) { // only update view with messages if we're at the bottom i.e. not paging up
    this.processMessages(opts)
  }
  this.bus.emit('render')
  this.updateTimer = null
}

NeatScreen.prototype.initializeCabalClient = function () {
  var details = this.client.getCurrentCabal()
  this.state.cabal = details
  this.state.messageScrollback = 0
  this.state.userScrollback = 0
  this.client.getCabalKeys().forEach((key) => {
    welcomeMessage.map((m) => this.client.getDetails(key).addStatusMessage({ text: m }, '!status'))
    // this.state.moderationKeys = this.state.cabal.core.adminKeys.map((k) => { return { key: k, type: 'admin' } }).concat(this.state.cabal.core.modKeys.map((k) => { return { key: k, type: 'mod' } }))
    if (this.state.moderationKeys.length > 0) {
      const moderationMessage = [
        'you joined via a moderation key, meaning you are allowing someone else to help administer moderation on your behalf.']
      // comment out how to remove applied moderators until it actually has a lasting effect across sessions, see https://github.com/cabal-club/cabal-cli/pull/190#discussion_r430021350
      // moderationMessage.push('if you would like to remove the applied moderation keys, type:')
      // this.state.moderationKeys.forEach((k) => {
      //   moderationMessage.push(`/un${k.type} ${k.key}`)
      // })
      moderationMessage.push('for more information, type /moderation')
      moderationMessage.forEach((text) => {
        this.client.getDetails(key).addStatusMessage({ text }, '!status')
      })
    }
  })
  this.bus.emit('render')
  this.registerUpdateHandler(details)
  this.loadChannel('default')
}

// check for collisions in the first four hex chars of the users in the cabal. used in NeatScreen.prototype.formatMessage
NeatScreen.prototype._updateCollisions = function () {
  this.state.collision = {}
  const userKeys = Object.keys(this.state.cabal.getUsers())
  userKeys.forEach((u) => {
    const collision = typeof this.state.collision[u.slice(0, 4)] !== 'undefined'
    // if there is a collision in the first 4 chars of a pub key in the cabal,
    // expand it to the largest length that lets us disambiguate between the colliding ids
    this.state.collision[u.slice(0, 4)] = { collision, idlen: (collision ? util.unambiguous(userKeys, u) : 4) }
  })
}

NeatScreen.prototype.registerUpdateHandler = function (cabal) {
  if (!this._updateHandler) this._updateHandler = {}
  if (this._updateHandler[cabal.key]) return // we already have a handler for that cabal
  this._updateHandler[cabal.key] = (updatedDetails) => {
    // insert timeout handler for to debounce events when tons are streaming in
    if (this.updateTimer) clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(() => {
      // update view
      this._handleUpdate(updatedDetails)
    }, 20)
  }
  // register an event handler for all updates from the cabal
  cabal.on('update', this._updateHandler[cabal.key])
  // create & register event handlers for channel archiving events
  const processChannelArchiving = (type, { channel, reason, key, isLocal }) => {
    const issuer = this.client.getUsers()[key]
    if (!issuer || isLocal) { return }
    reason = reason ? `(${chalk.cyan('reason:')} ${reason})` : ''
    const issuerName = issuer && issuer.name ? issuer.name : key.slice(0, 8)
    const action = type === 'archive' ? 'archived' : 'unarchived'
    const text = `${issuerName} ${chalk.magenta(action)} channel ${chalk.cyan(channel)} ${reason}`
    this.client.addStatusMessage({ text })
    this.bus.emit('render')
  }
  cabal.on('channel-archive', (envelope) => { processChannelArchiving('archive', envelope) })
  cabal.on('channel-unarchive', (envelope) => { processChannelArchiving('unarchive', envelope) })

  cabal.on('private-message', (envelope) => {
    // never display PMs inline from a hidden user
    if (envelope.author.isHidden()) return
    // don't display the notif if we're just sending something to ourselves (covered by publish-private-message event)
    if (envelope.author.key === cabal.getLocalUser().key) return
    // don't display the notification if we're already looking at the pm it came from
    if (cabal.getCurrentChannel() === envelope.channel) { return }
    const text = `PM [${envelope.author.name}]: ${envelope.message.value.content.text}`
    this.client.addStatusMessage({ text: chalk.magentaBright(text) })
  })

  cabal.on('publish-private-message', message => {
    // don't display the notification if we're already looking at the pm it came from
    if (cabal.getCurrentChannel() === message.content.channel) { return }
    const users = cabal.getUsers()
    const pubkey = message.content.channel
    let name = pubkey.slice(0, 8)
    if (pubkey in users) {
    // never display PMs inline from a hidden user
      if (users[pubkey].isHidden()) return
      name = users[pubkey].name
    }
    const text = `PM to [${name}]: ${message.content.text}`
    this.client.addStatusMessage({ text: chalk.magentaBright(text) })
  })
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
  opts.amount += this.additionalBacklog

  // var unreadCount = this.client.getNumberUnreadMessages()
  this.client.getMessages(opts, (msgs) => {
    this.state.messages = []
    msgs.forEach((msg, i) => {
      const user = this.client.getUsers()[msg.key]
      if (user && user.isHidden(opts.channel)) return
      this.state.messages.push(this.formatMessage(msg))
    })
    this.bus.emit('render')
    cb.bind(this)()
  })
}

NeatScreen.prototype.showCabal = function (cabal) {
  this.state.cabal = this.client.focusCabal(cabal)
  this.registerUpdateHandler(this.state.cabal)
  this.commander.setActiveCabal(this.state.cabal)
  this.client.focusChannel()
  this.bus.emit('render')
}

NeatScreen.prototype.renderApp = function (state) {
  if (process.stdout.columns > 80) return views.big(state)
  else return views.small(state)
}

// use to write anything else to the screen, e.g. info messages or emotes
NeatScreen.prototype.writeLine = function (text) {
  this.client.addStatusMessage({ text })
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

NeatScreen.prototype.moreBacklog = function () {
  this.additionalBacklog += this.BACKLOG_BATCH
  const text = `adding ${this.BACKLOG_BATCH} messages to backlog, total extra messages: ${this.additionalBacklog}`
  this.client.addStatusMessage({ text })
  this.processMessages()
}

NeatScreen.prototype.loadChannel = function (channel) {
  this.client.focusChannel(channel)
  // clear the old channel state
  this.state.messages = []
  this.state.topic = ''
  this.additionalBacklog = 0

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

    let author = util.sanitizeString(authorSource.name || authorSource.key.slice(0, 8))
    // add author field for later use in calculating the left-padding of multi-line messages
    msg.author = author
    var localNick = 'uninitialized'
    if (this.state) { localNick = this.state.cabal.getLocalName() }

    /* sanitize user inputs to prevent interface from breaking */
    localNick = util.sanitizeString(localNick)
    var msgtxt = msg.value.content.text
    if (msg.value.type !== 'status') {
      msgtxt = util.sanitizeString(msgtxt)
    }
    var content = markdown(msgtxt)

    if (localNick.length > 0 && msgtxt.indexOf(localNick) > -1 && author !== localNick) { highlight = true }

    if (authorSource.constructor.name === 'User') {
      if (authorSource.isAdmin()) author = chalk.green('@') + author
      else if (authorSource.isModerator()) author = chalk.green('%') + author
    }

    var color = keyToColour(msg.key) || colours[5]

    var timestamp = `${chalk.dim(formatTime(msg.value.timestamp, this.config.messageTimeformat))}`
    let authorText
    if (msg.value.type === 'status' || msg.value.type === 'chat/moderation') {
      highlight = false // never highlight from status
      authorText = `${chalk.dim('-')}${chalk.cyan('status')}${chalk.dim('-')}`
    } else {
      /* a user wrote a message, not the !status virtual message */

      // if there is a collision in the first 4 characters of a pub key in the cabal, expand it to the largest length that
      // lets us disambiguate between the two ids in the collision
      const collision = authorSource.key && this.state.collision[authorSource.key.slice(0, 4)]
      const pubid = collision && authorSource.key && authorSource.key.slice(0, collision.idlen)
      if (pubid && this.state.cabal.showIds) {
        authorText = `${chalk.dim('<')}${highlight ? chalk.whiteBright(author) : chalk[color](author)}${chalk.dim('.')}${chalk.inverse(chalk.cyan(pubid))}${chalk.dim('>')}`
      } else {
        authorText = `${chalk.dim('<')}${highlight ? chalk.whiteBright(author) : chalk[color](author)}${chalk.dim('>')}`
      }

      var emote = (msg.value.type === 'chat/emote')
      if (pubid && emote) {
        authorText = `${chalk.white(author)}${this.state.cabal.showIds ? chalk.dim('.') + chalk.inverse(chalk.cyan(pubid)) : ''}`
        content = `${chalk.dim(msgtxt)}`
      }
    }

    if (msg.value.type === 'chat/topic') {
      content = `${chalk.dim(`* sets the topic to ${chalk.cyan(msgtxt)}`)}`
    } else if (msg.value.type === 'chat/moderation') {
      const { role, type, issuerid, receiverid } = msg.value.content
      const issuer = this.client.getUsers()[issuerid]
      const receiver = this.client.getUsers()[receiverid]
      let action
      const reason = msg.value.content.reason ? `(${chalk.cyan('reason:')} ${msg.value.content.reason})` : ''
      const issuerName = issuer && issuer.name ? issuer.name : issuerid.slice(0, 8)
      const receiverName = receiver && receiver.name ? receiver.name : receiverid.slice(0, 8)
      if (['admin', 'mod'].includes(role)) {
        action = (type === 'add' ? chalk.green('added') : chalk.red('removed'))
        content = `${issuerName} ${action} ${receiverName} as ${chalk.cyan(role)} ${reason}`
      }
      if (role === 'hide') {
        action = (type === 'add' ? chalk.red('hid') : chalk.green('unhid'))
        content = `${issuerName} ${action} ${receiverName} ${reason}`
      }
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

function formatTime (t, fmt) {
  return strftime(fmt, new Date(t))
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
  'cyanBright'
  // 'whiteBright'
]

module.exports = NeatScreen
