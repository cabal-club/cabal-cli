var stripAnsi = require('strip-ansi')
var wcwidth = require('wcwidth')
var EmojiConverter = require('neato-emoji-converter')
var emojiConverter = new EmojiConverter()

function log (err, result) {
  if (err) { console.error('failed with', err) }
  if (arguments.length >= 2) { console.log(result) }
}

// return the most suitable moderation key.
// if we don't have one set, default to the current user's key.
// if we have joined via multiple keys, pick the first admin key.
// if we don't have any admin keys, but we do have a mod key, use that instead
// only return one, due to excessively long keys ':)
function getModerationKey (state) {
  let moderationKey = state.cabal.user ? `?admin=${state.cabal.user.key}` : ''
  if (state.moderationKeys.length > 0) {
    // if admin key is set, it will be at the top. otherwise we'll set a mod key
    const key = state.moderationKeys[0]
    moderationKey = `?${key.type}=${key.key}`
  }
  return moderationKey
}

function sanitizeString (str) {
  // some emoji break the cli: replace them with shortcodes
  str = emojiConverter.replaceUnicode(str)
  str = stripAnsi(str) // strip non-visible sequences
  /* eslint no-control-regex: "off" */
  return str.replace(/[\u0000-\u0009]|[\u000b-\u001f]/g, '') // keep newline (aka LF aka ascii character 10 aka \u000a)
}

// Character-wrap text containing ANSI escape codes.
// String, Int -> [String]
function wrapAnsi (text, width) {
  if (!text) return []

  text = sanitizeString(text)

  var res = []
  var line = ''
  var lineWidth = 0
  var insideCode = false
  var insideWord = false
  for (var i = 0; i < text.length; i++) {
    var chr = text.charAt(i)
    if (chr.charCodeAt(0) === 27) {
      insideCode = true
    }

    insideWord = !(chr.charCodeAt(0) === 32 || chr.charCodeAt(0) === 10) // ascii code for the SPACE character || NEWLINE character

    if (chr !== '\n') {
      line += chr
    }

    if (!insideCode) {
      lineWidth += wcwidth(text.charAt(i))
      if (chr === '\n') {
        res.push(line)
        line = ''
        lineWidth = 0
      } else if (lineWidth > width) {
        line = line.slice(0, line.length - 1); i-- // Don't include the char that brought us over the width; reuse it
        const breakpoint = line.lastIndexOf(' ')
        if (insideWord && breakpoint >= 0) {
          res.push(line.slice(0, breakpoint)) // grab the first part of the line and push its str as a result
          line = line.slice(breakpoint + 1) // take the part after the breakpoint and add to new line
          lineWidth = line.length
        } else {
          res.push(line)
          line = ''
          lineWidth = 0
        }
      }
    }

    if (chr === 'm' && insideCode) {
      insideCode = false
    }
  }

  res.push(line)

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

// Returns the horizontal visual extent (# of fixed-width chars) a string takes
// up, taking ANSI escape codes into account. Assumes a UTF-8 encoded string.
function strwidth (str) {
  return wcwidth(stripAnsi(str))
}

function centerText (text, width) {
  var left = Math.floor((width - strwidth(text)) / 2)
  var right = Math.ceil((width - strwidth(text)) / 2)
  var lspace = left > 0 ? new Array(left).fill(' ').join('') : ''
  var rspace = right > 0 ? new Array(right).fill(' ').join('') : ''
  return lspace + text + rspace
}

function rightAlignText (text, width) {
  var left = width - strwidth(text)
  if (left < 0) return text
  var lspace = new Array(left).fill(' ').join('')
  return lspace + text
}

// find the shortest length that is unambiguous when matching `key` for each entry in `keys`
function unambiguous (keys, key) {
  var n = 0
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (key === k) continue
    var len = Math.min(k.length, key.length)
    for (var j = 0; j < len; j++) {
      n = Math.max(n, j)
      if (key.charAt(j) !== k.charAt(j)) break
    }
  }
  return n + 1
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
  if (!a.isHidden() && b.isHidden()) return -1
  if (!b.isHidden() && a.isHidden()) return 1
  if (a.online && !b.online) return -1
  if (b.online && !a.online) return 1
  if (a.isAdmin() && !b.isAdmin()) return -1
  if (b.isAdmin() && !a.isAdmin()) return 1
  if (a.isModerator() && !b.isModerator()) return -1
  if (b.isModerator() && !a.isModerator()) return 1
  if (a.name && !b.name) return -1
  if (b.name && !a.name) return 1
  if (a.name && b.name) return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
  return a.key < b.key ? -1 : 1
}

module.exports = { cmpUser, log, wrapAnsi, strlenAnsi, centerText, rightAlignText, wrapStatusMsg, sanitizeString, unambiguous, getModerationKey, strwidth }
