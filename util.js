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


module.exports = {log: logResult, wrapAnsi: wrapAnsi}
