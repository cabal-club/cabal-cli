var stripAnsi = require('strip-ansi')
var EmojiConverter = require('neato-emoji-converter')
var emojiConverter = new EmojiConverter()

function log (err, result) {
  if (err) { console.error('failed with', err) }
  if (arguments.length >= 2) { console.log(result) }
}

function sanitizeString (str) {
  // emojis break the cli: replace them with shortcodes
  str = emojiConverter.replaceUnicode(str)
  str = stripAnsi(str) // strip non-visible sequences
  return str.replace(/[\u0000-\u0009]|[\u000b-\u001f]/g, '') // keep newline (aka LF aka ascii character 10 aka \u000a)
}
// Character-wrap text containing ANSI escape codes.
// String, Int -> [String]
function wrapAnsi (text, width, padding = 11) {
  if (!text) return []

  var res = []

  var line = []
  var lineLen = 0
  var insideCode = false
  var insideWord = false
  for (var i = 0; i < text.length; i++) {
    var chr = text.charAt(i)
    if (chr.charCodeAt(0) === 27) {
      insideCode = true
    }

    insideWord = !(chr.charCodeAt(0) === 32 || chr.charCodeAt(0) === 10) // ascii code for the SPACE character || NEWLINE character

    if (chr !== '\n') {
      line.push(chr)
    }

    if (!insideCode) {
      lineLen++
      if (lineLen >= width - 1 || chr === '\n') {
        const breakpoint = line.lastIndexOf(' ')
        if (insideWord && breakpoint >= 0) { // breakpoint is -1 when e.g. a superlong url is posted; there exists no space before it
          res.push(line.slice(0, breakpoint).join('')) // grab the first part of the line and push its str as a result
          line = [' '.repeat(padding)].concat(line.slice(breakpoint + 1)) // take the part after the breakpoint and add to new line
          lineLen = padding + line.slice(1).length // `padding` is counted separately cause it's added as a single string (not array elements)
        } else {
          res.push(line.join(''))
          line = [' '.repeat(padding)]
          lineLen = padding
        }
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

// Length of 'str' sans ANSI codes
function strlenAnsi (str) {
  var len = 0
  var insideCode = false

  for (var i = 0; i < str.length; i++) {
    var chr = str.charAt(i)
    if (chr.charCodeAt(0) === 27) insideCode = true
    if (!insideCode) len++
    if (chr === 'm' && insideCode) insideCode = false
  }

  return len
}

function centerText (text, width) {
  var left = Math.floor((width - strlenAnsi(text)) / 2)
  var right = Math.ceil((width - strlenAnsi(text)) / 2)
  var lspace = left > 0 ? new Array(left).fill(' ').join('') : ''
  var rspace = right > 0 ? new Array(right).fill(' ').join('') : ''
  return lspace + text + rspace
}

function rightAlignText (text, width) {
  var left = width - strlenAnsi(text)
  if (left < 0) return text
  var lspace = new Array(left).fill(' ').join('')
  return lspace + text
}

function wrapStatusMsg (m) {
  return {
    key: 'status',
    value: {
      timestamp: Date.now(),
      type: 'chat/text',
      content: {
        text: m
      }
    }
  }
}

function cmpUser (a, b) {
  if (a.online && !b.online) return -1
  if (b.online && !a.online) return 1
  if (a.name && !b.name) return -1
  if (b.name && !a.name) return 1
  if (a.name && b.name) return a.name < b.name ? -1 : 1
  return a.key < b.key ? -1 : 1
}

module.exports = { cmpUser, log, wrapAnsi, strlenAnsi, centerText, rightAlignText, wrapStatusMsg, sanitizeString }
