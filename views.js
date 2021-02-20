var output = require('./output')
var chalk = require('chalk')
var blit = require('txt-blit')
var util = require('./util')
var version = require('./package.json').version

const HEADER_ROWS = 8
const NICK_COLS = 15
const CHAN_COLS = 16

module.exports = { big, small, getPageSize }

function getPageSize () {
  return process.stdout.rows - HEADER_ROWS
}

function small (state) {
  var screen = []
  var titlebarSize = Math.ceil(linkSize(state) / process.stdout.columns)
  // title bar
  blit(screen, renderTitlebar(state, process.stdout.columns), 0, titlebarSize - 1)
  // chat messages
  blit(screen, renderMessages(state, process.stdout.columns, process.stdout.rows - HEADER_ROWS), 0, 3)
  // horizontal dividers
  blit(screen, renderHorizontalLine('-', process.stdout.columns, chalk.blue), 0, process.stdout.rows - 2)
  blit(screen, renderHorizontalLine('-', process.stdout.columns, chalk.blue), 0, titlebarSize + 1)
  // user input prompt
  blit(screen, renderPrompt(state), 0, process.stdout.rows - 1)
  return output(screen.join('\n'))
}

function big (state) {
  var screen = []
  // title bar
  blit(screen, renderTitlebar(state, process.stdout.columns), 0, 0)

  if (state.cabals.length > 1) {
    // cabals pane
    blit(screen, renderCabals(state, 6, process.stdout.rows - HEADER_ROWS), 0, process.stdout.rows - 3)
  }
  // channels listing
  blit(screen, renderChannels(state, CHAN_COLS, process.stdout.rows - HEADER_ROWS), 0, 3)
  blit(screen, renderVerticalLine('|', process.stdout.rows - 7, chalk.blue), 16, 3)

  // channel topic description
  blit(screen, renderChannelTopic(state, process.stdout.columns - 16 - 17, process.stdout.rows - HEADER_ROWS), 17, 3)
  // chat messages
  blit(screen, renderMessages(state, process.stdout.columns - 17 - 17, process.stdout.rows - HEADER_ROWS), 17, 4)

  // nicks pane
  blit(screen, renderVerticalLine('|', process.stdout.rows - 7, chalk.blue), process.stdout.columns - 17, 3)
  blit(screen, renderNicks(state, NICK_COLS, process.stdout.rows - HEADER_ROWS), process.stdout.columns - 15, 3)

  // horizontal dividers
  blit(screen, renderHorizontalLine('-', process.stdout.columns, chalk.blue), 0, process.stdout.rows - 4)
  blit(screen, renderHorizontalLine('-', process.stdout.columns, chalk.blue), 0, 2)

  // user input prompt
  blit(screen, renderPrompt(state), 0, process.stdout.rows - 2)

  return output(screen.join('\n'))
}

function linkSize (state) {
  const moderationKey = util.getModerationKey(state)
  if (state.cabal.key) return `cabal://${state.cabal.key.toString('hex')}`.length + moderationKey.length
  else return 'cabal://...'
}

function renderPrompt (state) {
  var name = util.sanitizeString(state.cabal ? state.cabal.getLocalName() : 'unknown')
  return [
    `[${chalk.cyan(name)}:${state.cabal.getCurrentChannel()}] ${state.neat.input.line()}`
  ]
}

function renderTitlebar (state, width) {
  const moderationKey = chalk.cyan(util.getModerationKey(state))
  return [
    chalk.bgBlue(util.centerText(chalk.whiteBright.bold(`CABAL@${version}`), width)),
    util.rightAlignText(`cabal://${state.cabal.key.toString('hex')}${moderationKey}`, width)
  ]
}

function renderCabals (state, width, height) {
  return ['[' + state.cabals.map(function (cabal, idx) {
    var key = cabal
    var keyTruncated = key.substring(0, 6)
    // if we're dealing with the active/focused cabal
    if (state.cabal.key === key) {
      if (state.selectedWindowPane === 'cabals') {
        return `(${chalk.bgBlue(keyTruncated)})`
      } else {
        return `(${chalk.cyan(keyTruncated)})`
      }
    } else {
      return chalk.white(keyTruncated)
    }
  }).join(' ') + ']']
}

function renderChannels (state, width, height) {
  const channels = state.cabal.getJoinedChannels()
  const numPrefixWidth = String(channels.length).length
  return channels
    .map((channel, idx) => {
      var channelTruncated = channel.substring(0, width - 5)
      var unread = channel in state.unreadChannels
      var mentioned = channel in state.mentions

      const channelIdx = idx + 1
      let numPrefix = channelIdx + '. '
      const numLength = String(channelIdx).length
      if (numLength < numPrefixWidth) {
        numPrefix += new Array(numLength).fill(' ').join('')
      }
      numPrefix = chalk.cyan(numPrefix)

      if (state.cabal.getCurrentChannel() === channel) {
        var fillWidth = width - channelTruncated.length - 5
        var fill = (fillWidth > 0) ? new Array(fillWidth).fill(' ').join('') : ''
        if (state.selectedWindowPane === 'channels') {
          return ' ' + chalk.whiteBright(chalk.bgBlue(numPrefix + channelTruncated + fill))
        } else {
          return ' ' + chalk.bgBlue(numPrefix + channelTruncated + fill)
        }
      } else {
        if (mentioned) return ' ' + numPrefix + '@' + chalk.magenta(channelTruncated)
        else if (unread) return ' ' + numPrefix + '*' + chalk.green(channelTruncated)
        else return ' ' + numPrefix + channelTruncated
      }
    }).slice(0, height)
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
  // All known users
  var users = state.cabal.getChannelMembers()
  const currentChannel = state.cabal.getCurrentChannel()
  users = Object.keys(users)
    .map(key => users[key])
    .sort(util.cmpUser)

  function getPrintedName (user) {
    if (user && user.name) return user.name
    else return user.key.slice(0, 8)
  }

  // Count how many occurances of same nickname there are
  const onlineNickCount = {}
  const offlineNickCount = {}
  users.forEach(user => {
    const name = getPrintedName(user)
    if (user.online) onlineNickCount[name] = name in onlineNickCount ? onlineNickCount[name] + 1 : 1
    else offlineNickCount[name] = name in offlineNickCount ? offlineNickCount[name] + 1 : 1
  })

  // Format and colorize names
  const seen = {}
  const formattedNicks = users
    .filter(user => {
      const name = getPrintedName(user)
      if (seen[name]) return false
      seen[name] = true
      return true
    })
    .map(user => {
      const name = getPrintedName(user)
      let outputName

      // Duplicate nick count
      const duplicates = user.online ? onlineNickCount[name] : offlineNickCount[name]
      const dupecountStr = `(${duplicates})`
      const modSigilLength = (user.isAdmin(currentChannel) || user.isModerator(currentChannel) || user.isHidden(currentChannel)) ? 1 : 0
      outputName = util.sanitizeString(name).slice(0, width - modSigilLength)
      if (duplicates > 1) outputName = outputName.slice(0, width - dupecountStr.length - 2 - modSigilLength)

      // Colorize
      let colorizedName = outputName.slice()
      if (user.isAdmin(currentChannel)) colorizedName = chalk.green('@') + colorizedName
      else if (user.isModerator(currentChannel)) colorizedName = chalk.green('%') + colorizedName
      else if (user.isHidden(currentChannel)) colorizedName = chalk.green('-') + colorizedName
      if (user.online) {
        colorizedName = chalk.bold(colorizedName)
      }
      if (duplicates > 1) colorizedName += ' ' + chalk.green(dupecountStr)
      return colorizedName
    })

  // Scrolling Rendering
  state.userScrollback = Math.min(state.userScrollback, formattedNicks.length - height)
  if (formattedNicks.length < height) state.userScrollback = 0
  var nickBlock = formattedNicks.slice(state.userScrollback, state.userScrollback + height)

  return nickBlock
}

function renderChannelTopic (state, width, height) {
  var topic = state.topic || state.channel
  var line = topic ? '➤ ' + topic : ''
  line = line.substring(0, width - 1)
  if (line.length === width - 1) {
    line = line.substring(0, line.length - 1) + '…'
  }
  line = line + new Array(width - line.length - 1).fill(' ').join('')
  return [chalk.whiteBright(chalk.bgBlue(line))]
}

function renderMessages (state, width, height) {
  var msgs = state.messages

  // Character-wrap to area edge
  var allLines = msgs.reduce(function (accum, msg) {
    const nickLength = msg.raw.author ? msg.raw.author.length : 0
    var indent = 0
    if (state.config.messageIndent === 'time' ||
        state.config.messageIndent === 'nick') {
      indent += state.messageTimeLength + 1 // + space
    }
    if (state.config.messageIndent === 'nick') {
      indent += nickLength + 3 // + space and <>
    }
    accum.push.apply(accum, util.wrapAnsi(msg.formatted, width, indent))
    return accum
  }, [])

  // Scrollable Content

  state.messageScrollback = Math.min(state.messageScrollback, allLines.length - height)
  if (allLines.length < height) {
    state.messageScrollback = 0
  }

  var lines = (allLines.length < height)
    ? allLines.concat(Array(height - allLines.length).fill(''))
    : allLines.slice(
      allLines.length - height - state.messageScrollback,
      allLines.length - state.messageScrollback
    )
  if (state.messageScrollback > 0) {
    lines = lines.slice(0, lines.length - 1).concat(['More messages below...'])
  }
  return lines
}
