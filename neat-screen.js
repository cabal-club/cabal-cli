var Cabal = require('cabal-core')
var chalk = require('chalk')
var collect = require('collect-stream')
var Commander = require('./commands.js')
var fs = require('fs')
var neatLog = require('neat-log')
var strftime = require('strftime')
var views = require('./views')
var yaml = require('js-yaml')
var emojiRegex = require('emoji-regex')
var emojiPattern = emojiRegex()
var util = require('./util')

var markdown = require('./markdown-shim')
var statusMessages = ['welcome to cabal', 'for more info visit https://github.com/cabal-club/cabal']
statusMessages = statusMessages.map(util.wrapStatusMsg)

const HEADER_ROWS = 6

function NeatScreen (props) {
  if (!(this instanceof NeatScreen)) return new NeatScreen(props)
  var self = this

  this.archivesdir = props.archivesdir
  this.configFilePath = props.configFilePath
  this.homedir = props.homedir
  this.databaseVersion = props.databaseVersion
  this.rootdir = props.rootdir
  this.config = props.config
  this.isExperimental = props.isExperimental
  this.maxFeeds = props.maxFeeds

  this.commander = Commander(this, props.cabals[0])

  this.neat = neatLog(renderApp, { fullscreen: true,
    style: function (start, cursor, end) {
      if (!cursor) cursor = ' '
      return start + chalk.underline(cursor) + end
    } }
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
      var users = Object.keys(self.state.cabal.client.users)
        .map(key => self.state.cabal.client.users[key])
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

  // move between window panes with ctrl+j
  this.neat.input.on('alt-n', () => {
    var currentIdx = self.state.windowPanes.indexOf(self.state.selectedWindowPane)
    if (currentIdx !== -1) {
      currentIdx++
      currentIdx = currentIdx % self.state.windowPanes.length
      setSelectedWindowPaneByIndex(currentIdx)
    }
  })

  // move up/down channels with ctrl+{n,p}
  this.neat.input.on('ctrl-p', () => {
    var currentIdx
    if (self.state.selectedWindowPane === 'cabals') {
      currentIdx = self.state.cabals.findIndex((cabal) => cabal.key === self.commander.cabal.key)
      if (currentIdx !== -1) {
        currentIdx--
        if (currentIdx < 0) currentIdx = self.state.cabals.length - 1
        setCabalByIndex(currentIdx)
      }
    } else {
      currentIdx = self.state.cabal.client.channels.indexOf(self.commander.channel)
      if (currentIdx !== -1) {
        currentIdx--
        if (currentIdx < 0) currentIdx = self.state.cabal.client.channels.length - 1
        setChannelByIndex(currentIdx)
      }
    }
  })
  this.neat.input.on('ctrl-n', () => {
    var currentIdx
    if (self.state.selectedWindowPane === 'cabals') {
      currentIdx = self.state.cabals.findIndex((cabal) => cabal.key === self.commander.cabal.key)
      if (currentIdx !== -1) {
        currentIdx++
        currentIdx = currentIdx % self.state.cabals.length
        setCabalByIndex(currentIdx)
      }
    } else {
      currentIdx = self.state.cabal.client.channels.indexOf(self.commander.channel)
      if (currentIdx !== -1) {
        currentIdx++
        currentIdx = currentIdx % self.state.cabal.client.channels.length
        setChannelByIndex(currentIdx)
      }
    }
  })

  function setCabalByIndex (n) {
    if (n < 0 || n >= self.state.cabals.length) return
    self.showCabal(self.state.cabals[n])
  }

  function setChannelByIndex (n) {
    if (n < 0 || n >= self.state.cabal.client.channels.length) return
    self.commander.channel = self.state.cabal.client.channels[n]
    self.loadChannel(self.state.cabal.client.channels[n])
  }

  function setSelectedWindowPaneByIndex (n) {
    if (n < 0 || n >= self.state.windowPanes.length) return
    self.state.selectedWindowPane = self.state.windowPanes[n]
  }

  this.neat.input.on('ctrl-d', () => process.exit(0))
  this.neat.input.on('pageup', () => self.state.cabal.client.scrollback++)
  this.neat.input.on('pagedown', () => { self.state.cabal.client.scrollback = Math.max(0, self.state.cabal.client.scrollback - 1); return null })

  this.neat.use(function (state, bus) {
    state.neat = self.neat
    self.state = state
    self.bus = bus

    self.state.cabals = props.cabals
    self.state.cabal = props.cabals[0]

    state.selectedWindowPane = 'channels'
    state.windowPanes = [state.selectedWindowPane]
    if (state.cabals.length > 1) {
      state.windowPanes.push('cabals')
    }

    self.state.cabals.forEach((cabal) => {
      self.initializeCabalClient(cabal)
    })
  })
}

NeatScreen.prototype.initializeCabalClient = function (cabal) {
  var self = this
  cabal.client = {
    channel: '!status',
    channels: ['!status'],
    messages: [],
    user: { local: true, online: true, key: '' },
    users: {}
  }

  this.commander.commands.help.call()
  self.state.cabal.client = cabal.client

  cabal.ready(function () {
    cabal.channels.get((err, channels) => {
      if (err) return
      cabal.client.channels = cabal.client.channels.concat(channels)
      self.loadChannel(cabal.client.channel)
      self.bus.emit('render')

      cabal.channels.events.on('add', function (channel) {
        cabal.client.channels.push(channel)
        cabal.client.channels.sort()
        self.bus.emit('render')
      })
    })

    cabal.users.getAll(function (err, users) {
      if (err) return
      cabal.client.users = users

      updateLocalKey()

      cabal.users.events.on('update', function (key) {
        // TODO: rate-limit
        cabal.users.get(key, function (err, user) {
          if (err) return
          cabal.client.users[key] = Object.assign(cabal.client.users[key] || {}, user)
          if (cabal.client.user && key === cabal.client.user.key) cabal.client.user = cabal.client.users[key]
          if (!cabal.client.user) updateLocalKey()
          self.bus.emit('render')
        })

        cabal.topics.events.on('update', function (msg) {
          self.state.topic = msg.value.content.topic
          self.bus.emit('render')
        })
      })

      cabal.on('peer-added', function (key) {
        var found = false
        Object.keys(cabal.client.users).forEach(function (k) {
          if (k === key) {
            cabal.client.users[k].online = true
            found = true
          }
        })
        if (!found) {
          cabal.client.users[key] = {
            key: key,
            online: true
          }
        }
        self.bus.emit('render')
      })
      cabal.on('peer-dropped', function (key) {
        Object.keys(cabal.client.users).forEach(function (k) {
          if (k === key) {
            cabal.client.users[k].online = false
            self.bus.emit('render')
          }
        })
      })

      function updateLocalKey () {
        cabal.getLocalKey(function (err, lkey) {
          // set local key for local user
          cabal.client.user.key = lkey
          if (err) return self.bus.emit('render')
          // try to get more data for user
          Object.keys(users).forEach(function (key) {
            if (key === lkey) {
              cabal.client.user = users[key]
              cabal.client.user.local = true
              cabal.client.user.online = true
            }
          })
          self.bus.emit('render')
        })
      }
    })
  })
}

NeatScreen.prototype.addCabal = function (key) {
  var self = this
  if (!self.isExperimental) { return }
  key = key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
  var db = this.archivesdir + key
  var cabal = Cabal(db, key, { maxFeeds: this.maxFeeds })
  cabal.ready(() => {
    self.state.cabals.push(cabal)
    cabal.swarm()
    self.initializeCabalClient(cabal)
    self.showCabal(cabal)
    self.config.cabals = self.state.cabals.map((cabal) => cabal.key)
    saveConfig(self.config, this.configFilePath)
  })
}

NeatScreen.prototype.showCabal = function (cabal) {
  this.state.cabal = cabal
  this.state.cabal.client = cabal.client
  this.commander.cabal = cabal
  this.loadChannel(this.state.cabal.client.channel)
  this.bus.emit('render')
}

function renderApp (state) {
  if (process.stdout.columns > 80) return views.big(state)
  else return views.small(state)
}

// use to write anything else to the screen, e.g. info iessages or emotes
NeatScreen.prototype.writeLine = function (line) {
  var msg = `${chalk.dim(line)}`
  this.state.cabal.client.messages.push(msg)
  statusMessages.push(util.wrapStatusMsg(msg))
  this.bus.emit('render')
}

NeatScreen.prototype.clear = function () {
  this.state.cabal.client.messages = []
  this.bus.emit('render')
}

NeatScreen.prototype.loadChannel = function (channel) {
  var self = this
  if (self.state.cabal.client.msgListener) {
    self.state.cabal.messages.events.removeListener(self.state.cabal.client.channel, self.state.cabal.client.msgListener)
    self.state.cabal.client.msgListener = null
  }

  // This is really cheap, so we could load many more if we wanted to!
  var MAX_MESSAGES = process.stdout.rows - HEADER_ROWS + 50

  self.state.cabal.client.channel = channel

  // clear the old channel state
  self.state.cabal.client.scrollback = 0
  self.state.cabal.client.messages = []
  self.state.topic = ''
  self.neat.render()

  if (channel === '!status') {
    self.state.cabal.client.messages = statusMessages.map(self.formatMessage)
    self.neat.render()
    return
  }

  var pending = 0
  function onMessage () {
    if (pending > 0) {
      pending++
      return
    }
    pending = 1

    // TODO: wrap this up in a nice interface and expose it via cabal-client
    var rs = self.state.cabal.messages.read(channel, { limit: MAX_MESSAGES, lt: '~' })
    collect(rs, function (err, msgs) {
      if (err) return
      msgs.reverse()

      self.state.cabal.client.messages = []
      var latestTimestamp = new Date(0)

      msgs.forEach(function (msg) {
        var msgDate = new Date(msg.value.timestamp)
        if (strftime('%F', msgDate) > strftime('%F', latestTimestamp)) {
          latestTimestamp = msgDate
          self.state.cabal.client.messages.push(`${chalk.gray('day changed to ' + strftime('%e %b %Y', latestTimestamp))}`)
        }
        self.state.cabal.client.messages.push(self.formatMessage(msg))
      })

      self.neat.render()

      self.state.cabal.topics.get(channel, (err, topic) => {
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

  self.state.cabal.messages.events.on(channel, onMessage)
  self.state.cabal.client.msgListener = onMessage

  onMessage()
}

NeatScreen.prototype.render = function () {
  this.bus.emit('render')
}

NeatScreen.prototype.formatMessage = function (msg) {
  var self = this
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
  if (msg.value.content && msg.value.timestamp) {
    var author
    if (self.state && self.state.cabal.client.users && self.state.cabal.client.users[msg.key]) author = self.state.cabal.client.users[msg.key].name || self.state.cabal.client.users[msg.key].key.slice(0, 8)
    else author = msg.key.slice(0, 8)
    var localNick = 'uninitialized'
    if (self.state) {
      localNick = self.state.cabal.client.user.name
    }
    // emojis.break the cli: replace them with a cabal symbol
    var msgtxt = msg.value.content.text.replace(emojiPattern, '➤')
    if (msgtxt.indexOf(localNick) > -1 && author !== localNick) { highlight = true }

    var color = keyToColour(msg.key) || colours[5]

    var timestamp = `${chalk.dim(formatTime(msg.value.timestamp))}`
    var authorText = `${chalk.dim('<')}${highlight ? chalk.whiteBright(author) : chalk[color](author)}${chalk.dim('>')}`
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

function saveConfig (config, path) {
  let data = yaml.safeDump(config, {
    sortKeys: true
  })
  fs.writeFileSync(path, data, 'utf8')
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
