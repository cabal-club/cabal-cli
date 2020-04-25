var util = require('./util')
var chalk = require('chalk')

function Commander (view, client) {
  if (!(this instanceof Commander)) return new Commander(view, client)
  this._hasListeners = {}
  this.client = client
  this.cabal = null
  this.setActiveCabal(client.getCurrentCabal())
  this.channel = '!status'
  this.view = view
  this.pattern = (/^\/(\w*)\s*(.*)/)
  this.history = []
  this.historyIndex = -1 // negative: new msg. >=0: index from the last item
}

Commander.prototype.setActiveCabal = function (cabal) {
  this.cabal = cabal
  if (this._hasListeners[cabal.key]) return
  var log = this.logger()
  this.cabal.on('info', (msg) => {
    var txt = typeof msg === 'string' ? msg : (msg && msg.text ? msg.text : '')
    log('* ' + util.sanitizeString(txt))
  })
  this.cabal.on('error', (err) => {
    log(chalk.bold(chalk.red('! ' + util.sanitizeString(String(err)))))
  })
  this._hasListeners[cabal.key] = true
}

// for use when writing multiple logs within short intervals
// to keep timestamp ordering correct. see usage for the `help` command above
Commander.prototype.logger = function () {
  var counter = -1000 // set counter 1000 ms in the past to prevent status messages from being purged due to being in the future
  function ts () {
    return Date.now() + counter++
  }
  var logToView = (msg) => {
    this.view.writeLine.bind(this.view)(msg, ts())
  }
  return logToView
}

Commander.prototype.process = function (line) {
  line = line.trim()
  this.history.push(line)
  this.historyIndex = -1
  if (this.history.length > 1000) this.history.shift()
  this.cabal.processLine(line)
  this.client.markChannelRead()
}

module.exports = Commander
