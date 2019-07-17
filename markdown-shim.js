var ansiEscapes = require("ansi-escapes")
var supportsHyperlinks = require("supports-hyperlinks")

var linkPattern = /(\[(.+?)\]\((\S+)\))/

function linkify (text, url) {
    return supportsHyperlinks.stdout ? ansiEscapes.link(text, url) : `${text} (${url})`
}

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
