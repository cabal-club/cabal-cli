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
  return `cabal://${state.cabal.db.key.toString('hex')}`.length
}

function renderPrompt (state) {
  return [
    `[${chalk.cyan(state.cabal.username)}:${state.channel}] ${state.neat.input.line()}`
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
    .map(function (key) {
      var about = state.users[key]
      if (about && about.name) return about.name.slice(0, width)
      else return key.slice(0, width)
    })
  return users
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
