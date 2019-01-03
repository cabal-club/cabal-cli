var linkify = require('terminal-link')
var linkPattern = /(\[(.+?)\]\((\S+)\))/
// naively parse markdown and return it as a terminal friendly formatting
module.exports = function (line) {
  var match
  // handle links
  while ((match = linkPattern.exec(line)) !== null) {
    var text = match[2]
    var url = match[3]
    var linkified = linkify(text, url)
    // replace the entire capture group with its linkified equivalent
    line = line.replace(match[1], linkified)
  }
  return line
}
