var output = require('./output')
var chalk = require('chalk')
var blit = require('txt-blit')
var util = require('./util')
var version = require('./package.json').version

const HEADER_ROWS = 7

module.exports = { big, small }

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
    blit(screen, renderCabals(state, 6, process.stdout.rows - HEADER_ROWS), 0, 3)
    blit(screen, renderVerticalLine('|', process.stdout.rows - 6, chalk.blue), 6, 3)
    // channels pane
    blit(screen, renderChannels(state, 18, process.stdout.rows - HEADER_ROWS), 7, 3)
    blit(screen, renderVerticalLine('|', process.stdout.rows - 6, chalk.blue), 23, 3)
    // chat messages
    blit(screen, renderMessages(state, process.stdout.columns - 23 - 17, process.stdout.rows - HEADER_ROWS), 24, 3)
    // channel topic description
    if (state.topic) {
      blit(screen, renderChannelTopic(state, process.stdout.columns - 23 - 17, process.stdout.rows - HEADER_ROWS), 24, 3)
    }
  } else {
    // channels pane
    blit(screen, renderChannels(state, 16, process.stdout.rows - HEADER_ROWS), 0, 3)
    blit(screen, renderVerticalLine('|', process.stdout.rows - 6, chalk.blue), 16, 3)

    var chatY = 3
    // channel topic description
    if (state.topic) {
      blit(screen, renderChannelTopic(state, process.stdout.columns - 16 - 17, process.stdout.rows - HEADER_ROWS), 17, 3)
      chatY++
    }
    // chat messages
    blit(screen, renderMessages(state, process.stdout.columns - 17 - 17, process.stdout.rows - HEADER_ROWS), 17, chatY)
  }

  // nicks pane
  blit(screen, renderVerticalLine('|', process.stdout.rows - 6, chalk.blue), process.stdout.columns - 17, 3)
  blit(screen, renderNicks(state, 15, process.stdout.rows - HEADER_ROWS), process.stdout.columns - 15, 3)

  // horizontal dividers
  blit(screen, renderHorizontalLine('-', process.stdout.columns, chalk.blue), 0, process.stdout.rows - 3)
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
  var name = state.cabal.client.user ? (state.cabal.client.user.name || state.cabal.client.user.key.substring(0, 8)) : 'unknown'
  return [
    `[${chalk.cyan(name)}:${state.cabal.client.channel}] ${state.neat.input.line()}`
  ]
}

function renderTitlebar (state, width) {
  return [
    chalk.bgBlue(util.centerText(chalk.white.bold(`CABAL@${version}`), width)),
    util.rightAlignText(chalk.white(`cabal://${state.cabal.key.toString('hex')}`), width)
  ]
}

function renderCabals (state, width, height) {
  return state.cabals
    .map(function (cabal, idx) {
      var key = cabal.key
      var keyTruncated = key.substring(0, 4)
      if (state.cabal.key === key) {
        var fill = ' '
        if (state.selectedWindowPane === 'cabals') {
          return '>' + chalk.bgBlue(keyTruncated + fill)
        } else {
          return ' ' + chalk.bgBlue(keyTruncated + fill)
        }
      } else {
        return ' ' + chalk.white(keyTruncated)
      }
    })
}

function renderChannels (state, width, height) {
  return state.cabal.client.channels
    .map(function (channel, idx) {
      var channelTruncated = channel.substring(0, width - 3)
      if (state.cabal.client.channel === channel) {
        var fillWidth = width - channelTruncated.length - 3
        var fill = (fillWidth > 0) ? new Array(fillWidth).fill(' ').join('') : ''
        if (state.selectedWindowPane === 'channels') {
          return '>' + chalk.bgBlue(channelTruncated + fill)
        } else {
          return ' ' + chalk.bgBlue(channelTruncated + fill)
        }
      } else {
        return ' ' + chalk.white(channelTruncated)
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
  var users = Object.keys(state.cabal.client.users)
    .map(key => state.cabal.client.users[key])
    .sort(util.cmpUser)
  var onlines = {}

  users = users
    .map(function (user) {
      var name = ''
      if (user && user.name) name += user.name.slice(0, width)
      else name += user.key.slice(0, Math.min(8, width))
      if (user.online) { onlines[name] = name in onlines ? onlines[name] + 1 : 1 }
      return name
    })

  var nickCount = {}
  users.forEach(function (u) { nickCount[u] = u in nickCount ? nickCount[u] + 1 : 1 })
  return users.filter((u, i, arr) => arr.indexOf(u) === i).map((u) => {
    if (nickCount[u] === 1) return u in onlines ? u : chalk.gray(u)
    var dupecount = ` (${nickCount[u]})`
    var name = u.slice(0, 15 - dupecount.length)
    return (u in onlines ? name : chalk.gray(name)) + chalk.green(dupecount)
  }).slice(0, height)
}

function renderChannelTopic (state, width, height) {
  var topic = state.topic || state.channel
  var line = '➤ ' + topic
  line = line.substring(0, width - 1)
  if (line.length === width - 1) {
    line = line.substring(0, line.length - 1) + '…'
  }
  line = line + new Array(width - line.length - 1).fill(' ').join('')
  return [chalk.whiteBright(chalk.bgBlue(line))]
}

function renderMessages (state, width, height) {
  var msgs = state.cabal.client.messages

  // Character-wrap to area edge
  var allLines = msgs.reduce(function (accum, msg) {
    accum.push.apply(accum, util.wrapAnsi(msg, width))
    return accum
  }, [])

  state.cabal.client.scrollback = Math.min(state.cabal.client.scrollback, allLines.length - height)
  if (allLines.length < height) {
    state.cabal.client.scrollback = 0
  }

  var lines = (allLines.length < height)
    ? allLines.concat(Array(height - allLines.length).fill(''))
    : allLines.slice(
      allLines.length - height - state.cabal.client.scrollback,
      allLines.length - state.cabal.client.scrollback
    )
  if (state.cabal.client.scrollback > 0) {
    lines = lines.slice(0, lines.length - 2).concat(['', 'More messages below . . .'])
  }
  return lines
}
