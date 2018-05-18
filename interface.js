var util = require('./util.js')
var through = require('through2')
var concat = require('concat-stream')
function Interface (db) {
  if (!(this instanceof Interface)) return new Interface(db)
  this.db = db
}

Interface.prototype.writeMessage = function (channel, nick, msg) {
  var self = this
  self.db.get(`${channel}/latest`, (err, node) => {
    node = node || {value: 0}
    var latest = parseInt(node.value)
    var newLatest = latest + 1
    self.db.put(`${channel}/${newLatest}`, {text: msg, author: nick, time: Date.now()}, (err, node) => {
      self.db.put(`${channel}/latest`, newLatest)
    })
  })
}

var channelPattern = /channels\/(.*)\/.*/
Interface.prototype.getChannels = function () {
  var self = this
  return new Promise((resolve, reject) => {
    var stream = self.db.createReadStream('channels')
    var concatStream = concat((data) => {
      var channels = {}
      data.forEach((d) => {
        var match = channelPattern.exec(d)
        if (match && match[1]) {
          channels[match[1]] = true
        }
      })
      resolve(Object.keys(channels))
    })

    stream
      .pipe(through.obj(function (chunk, enc, next) {
        if (chunk.key.slice(-6) !== 'latest') this.push([chunk.key])
        next()
      }))
      .pipe(concatStream)
  })
}

Interface.prototype.test = function () {
  var self = this
  var stream = self.db.createReadStream('data')
  stream
    .pipe(through.obj(function (chunk, enc, next) {
      this.push(chunk.value)
      next()
    }))
    .pipe(process.stdout)

  self.db.list('data', (arr) => {
    console.log('DB.LIST')
    console.log(arr)
  })
}

Interface.prototype.getMessages = function (channel, max) {
  var self = this
  return new Promise((resolve, reject) => {
    self.db.get(`${channel}/latest`, (err, node) => {
      if (!node) return
      var latest = node.value
      var messagePromises = []
      for (var i = 0; i < max; i++) {
        if (latest - i < 1) break
        var promise = getMessage(latest - i, channel)
        messagePromises.push(promise)
      }

      function getMessage (time, channel) {
        return new Promise((resolve, reject) => {
          self.db.get(`${channel}/${time}`, (err, node) => {
            if (err) reject(err)
            resolve(node)
          })
        })
      }

      messagePromises.reverse()
      Promise.all(messagePromises).then((messages) => {
        resolve(messages)
      })
    })
  })
}
module.exports = Interface
