var util = require('./util')
var chalk = require('chalk')

function Commander (view, client) {
  if (!(this instanceof Commander)) return new Commander(view, client)
  this._hasListeners = {}
  this.client = client
  this.cabal = null
  this.setActiveCabal(client.getCurrentCabal())
  this.view = view
  this.pattern = (/^\/(\w*)\s*(.*)/)
  this.history = []
  this.historyIndex = -1 // negative: new msg. >=0: index from the last item
}

Commander.prototype.setActiveCabal = function (cabal) {
  this.cabal = cabal
  if (this._hasListeners[cabal.key]) return
  this.cabal.on('info', (msg) => {
    var txt = typeof msg === 'string' ? msg : (msg && msg.text ? msg.text : '')
    this.view.writeLine('* ' + util.sanitizeString(txt))
  })
  this.cabal.on('error', (err) => {
    this.view.writeLine(chalk.bold(chalk.red('! ' + util.sanitizeString(String(err)))))
  })
  this._hasListeners[cabal.key] = true
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
