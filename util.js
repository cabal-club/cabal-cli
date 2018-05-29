function logResult (err, result) {
  if (err) { console.error('hyperdb failed with', err) }
  if (arguments.length >= 2) { console.log(result) }
}

// Character-wrap text containing ANSI escape codes.
// String, Int -> [String]
function wrapAnsi (text, width) {
  if (!text) return []

  var res = []

  var line = []
  var lineLen = 0
  var insideCode = false
  for (var i=0; i < text.length; i++) {
    var chr = text.charAt(i)
    if (chr === '\033') {
      insideCode = true
    }

    line.push(chr)

    if (!insideCode) {
      lineLen++
      if (lineLen >= width - 1) {
        res.push(line.join(''))
        line = []
        lineLen = 0
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

  for (var i=0; i < str.length; i++) {
    var chr = str.charAt(i)
    if (chr === '\033') insideCode = true
    if (!insideCode) len++
    if (chr === 'm' && insideCode) insideCode = false
  }

  return len
}

function centerText (text, width) {
  var left = Math.floor((width - strlenAnsi(text)) / 2)
  var right = Math.ceil((width - strlenAnsi(text)) / 2)
  var lspace = new Array(left).fill(' ').join('')
  var rspace = new Array(right).fill(' ').join('')
  return lspace + text + rspace
}

function rightAlignText (text, width) {
  var left = width - strlenAnsi(text)
  if (left < 0) return text
  var lspace = new Array(left).fill(' ').join('')
  return lspace + text
}

module.exports = {log: logResult, wrapAnsi: wrapAnsi, strlenAnsi: strlenAnsi, centerText, rightAlignText}
