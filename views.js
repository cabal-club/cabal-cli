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
  if (state.cabal.key) return `cabal://${state.cabal.key.toString('hex')}`.length
  else return 'cabal://...'
}

function renderPrompt (state) {
  var name = util.sanitizeString(state.cabal ? state.cabal.getLocalName() : 'unknown')
  return [
    `[${chalk.cyan(name)}:${state.cabal.getCurrentChannel()}] ${state.neat.input.line()}`
  ]
}

function renderTitlebar (state, width) {
  return [
    chalk.bgBlue(util.centerText(chalk.whiteBright.bold(`CABAL@${version}`), width)),
    util.rightAlignText(`cabal://${state.cabal.key.toString('hex')}`, width)
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
  return state.cabal.getJoinedChannels()
    .map((channel, idx) => {
      var channelTruncated = channel.substring(0, width - 3)
      var unread = channel in state.unreadChannels
      var mentioned = channel in state.mentions
      if (state.cabal.getCurrentChannel() === channel) {
        var fillWidth = width - channelTruncated.length - 3
        var fill = (fillWidth > 0) ? new Array(fillWidth).fill(' ').join('') : ''
        if (state.selectedWindowPane === 'channels') {
          return '>' + chalk.whiteBright(chalk.bgBlue(channelTruncated + fill))
        } else {
          return ' ' + chalk.bgBlue(channelTruncated + fill)
        }
      } else {
        if (mentioned) return '@' + chalk.magenta(channelTruncated)
        else if (unread) return '*' + chalk.green(channelTruncated)
        else return ' ' + channelTruncated
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
  users = Object.keys(users)
    .map(key => users[key])
    .sort(util.cmpUser)

  // Check which users are online
  var onlines = {}
  const names = users.map(function (user) {
    var name = ''
    if (user && user.name) name += util.sanitizeString(user.name).slice(0, width)
    else name += user.key.slice(0, Math.min(8, width))
    if (user.online) onlines[name] = name in onlines ? onlines[name] + 1 : 1
    if (user.isAdmin()) name = chalk.green('@') + name
    else if (user.isModerator()) name = chalk.green('%') + name
    if (user.online) {
      name = chalk.bold(name)
    }
    return name
  })

  // Count how many occurances of same nickname there are
  var nickCount = {}
  names.forEach(function (u) { nickCount[u] = u in nickCount ? nickCount[u] + 1 : 1 })

  // Format nicks with online state and possible duplication
  var formattedNicks = names.filter((u, i, arr) => arr.indexOf(u) === i).map((u) => {
    // if (nickCount[u] === 1) return u in onlines ? chalk.bold(u) : chalk.gray(u)
    if (nickCount[u] === 1) return u
    var dupecount = ` (${nickCount[u]})`
    var name = u.slice(0, 15 - dupecount.length)
    name += chalk.green(dupecount)
    return name
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
