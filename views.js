var output = require('./output')
var chalk = require('chalk')
var blit = require('txt-blit')
var util = require('./util')

const HEADER_ROWS = 6

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

  // channels pane
  blit(screen, renderChannels(state, 16, process.stdout.rows - HEADER_ROWS), 0, 3)

  // chat messages
  blit(screen, renderMessages(state, process.stdout.columns - 17 - 17, process.stdout.rows - HEADER_ROWS), 18, 3)

  // nicks pane
  blit(screen, renderNicks(state, 15, process.stdout.rows - HEADER_ROWS), process.stdout.columns - 15, 3)

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

function linkSize (state) {
  if (state.cabal.db.key) return `cabal://${state.cabal.db.key.toString('hex')}`.length
  else return 'cabal://...'
}

function renderPrompt (state) {
  var name = state.user ? (state.user.name || state.user.key.substring(0, 12)) : 'unknown'
  return [
    `[${chalk.cyan(name)}:${state.channel}] ${state.neat.input.line()}`
  ]
}

function renderTitlebar (state, width) {
  return [
    chalk.bgBlue(util.centerText(chalk.white.bold('CABAL'), width)),
    util.rightAlignText(chalk.white(`cabal://${state.cabal.key.toString('hex')}`), width)
  ]
}

function renderChannels (state, width, height) {
  return state.channels
    .map(function (channel, idx) {
      var channelTruncated = channel.substring(0, width - 5)
      if (state.channel === channel) {
        return ' ' + chalk.bgBlue((idx + 1) + '. ' + channelTruncated)
      } else {
        return ' ' + chalk.gray((idx + 1) + '. ') + chalk.white(channelTruncated)
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
  var users = Object.keys(state.users)
    .map(key => state.users[key])
    .sort(cmpUser)

  users = users
    .map(function (user) {
      var name = ''
      var sigil = ''
      // if (user.online) sigil = chalk.green('+')
      if (user && user.name) name += user.name.slice(0, width)
      else name += key.slice(0, width)
      if (!user.online) name = chalk.gray(name)
      return sigil + name
    })
  return users
}

function cmpUser (a, b) {
  if (a.online && !b.online) return -1
  if (b.online && !a.online) return 1
  if (a.name && !b.name) return -1
  if (b.name && !a.name) return 1
  if (a.name && b.name) return b.name - a.name
  return b.key - a.key
}

function renderMessages (state, width, height) {
  var msgs = state.messages

  // Character-wrap to area edge
  var allLines = msgs.reduce(function (accum, msg) {
    accum.push.apply(accum, util.wrapAnsi(msg, width))
    return accum
  }, [])

  state.scrollback = Math.min(state.scrollback, allLines.length - height)
  if (allLines.length < height) {
    state.scrollback = 0
  }

  var lines = (allLines.length < height)
    ? allLines.concat(Array(height - allLines.length).fill(''))
    : allLines.slice(
      allLines.length - height - state.scrollback,
      allLines.length - state.scrollback
    )
  if (state.scrollback > 0) {
    lines = lines.slice(0, lines.length - 2).concat(['', 'More messages below . . .'])
  }
  return lines
}
