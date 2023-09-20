// SPDX-FileCopyrightText: 2023 the cabal-club authors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

var util = require('./util')
var chalk = require('chalk')
var views = require('./views')

function Commander (view, client) {
  if (!(this instanceof Commander)) return new Commander(view, client)
  this._hasListeners = {}
  this.client = client
  this.cabal = null
  this.setActiveCabal(client.getCurrentCabal())
  this.view = view
  this.pattern = (/^\/(\w*)\s*(.*)/)
  this.history = []
  this.historyIndex = -1 // negative: new msg, >=0: index from the last item
}

Commander.prototype.setActiveCabal = function (cabal) {
  this.cabal = cabal
  if (this._hasListeners[cabal.key]) return
  this.cabal.on('info', (msg) => {
    var txt = typeof msg === 'string' ? msg : (msg && msg.text ? msg.text : '')
    txt = util.sanitizeString(txt)
    const meta = msg.meta
    if (meta.command) {
      switch (meta.command) {
        case 'channels':
          if (meta.seq === 0) break // don't rewrite the payload of the first `/channels` message
          var { joined, channel, userCount, topic } = msg
          var userPart = `${userCount} ${userCount === 1 ? 'person' : 'people'}`
          userPart = userCount > 0 ? ': ' + chalk.cyan(userPart) : ''
          var maxTopicLength = views.getChatWidth() - `00:00:00 -status-   ${channel}: 999 people `.length - 2 /* misc unknown padding that just makes it work v0v */
          var shortTopic = topic && topic.length > maxTopicLength ? topic.slice(0, maxTopicLength - 2) + '..' : topic || ''
          shortTopic = util.sanitizeString(shortTopic)
          channel = util.sanitizeString(channel)
          txt = `${joined ? '*' : ' '} ${channel}${userPart} ${shortTopic}`
          break
      }
    }
    this.view.writeLine(txt)
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
