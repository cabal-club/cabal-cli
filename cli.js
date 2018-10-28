#!/usr/bin/env node
var Cabal = require('cabal-core')
var swarm = require('cabal-core/swarm.js')
var minimist = require('minimist')
var os = require('os')
var fs = require('fs')
var yaml = require('js-yaml')

var frontend = require('./neat-screen.js')

var args = minimist(process.argv.slice(2))

var homedir = os.homedir()
var rootdir = args.dir || (homedir + '/.cabal/archives/')

var keys = []

var usage = `Usage

  cabal --key cabal://key

  OR

  cabal --db /path/to/db

  Options:

    --seed    Start a headless seed for the specified cabal key

    --message Publish a single message; then quit after \`timeout\`
    --channel Channel name to publish to for \`message\` option; default: "default"
    --timeout Delay in milliseconds to wait on swarm before quitting for \`message\` option; default: 5000
    --type    Message type set to message for \`message\` option; default: "chat/text"

Work in progress! Learn more at github.com/cabal-club
`

// Attempt to load local or homedir config file
try {
  var config
  var configFilename = '.cabal.yml'
  if (fs.existsSync(configFilename)) {
    config = yaml.safeLoad(fs.readFileSync(configFilename, 'utf8'))
  } else if (fs.existsSync(args.dir || homedir)) {
    config = yaml.safeLoad(fs.readFileSync((args.dir || homedir) + '/' + configFilename, 'utf8'))
  }
  if (config && config.keys) {
    keys = config.keys
  }
} catch (e) {
  console.log(e)
}

// Load a single cabal key
if (args.key) {
  var key = parseKey(args.key)
  var db = rootdir + key
  var cabal = Cabal(db, key)
  cabal.db.ready(function () {
    start([cabal])
  })
} else {
  // Load multiple keys from config
  if (keys.length) {
    Promise.all(keys.map((key) => {
      key = parseKey(key)
      var db = rootdir + key
      var cabal = Cabal(db, key)
      return new Promise((resolve) => {
        cabal.db.ready(() => {
          resolve(cabal)
        })
      })
    })).then((cabals) => {
      start(cabals)
    })
  } else if (args.db) {
    cabal = Cabal(args.db, null)
    cabal.db.ready(function () {
      cabal.getLocalKey(function (err, key) {
        if (err) throw err
        start([cabal])
      })
    })
  } else {
    process.stderr.write(usage)
    process.exit(1)
  }
}

function parseKey (key) {
  return key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
}

function start (cabals = []) {
  if (!args.seed) {
    if (args.key && args.message) {
      publishSingleMessage({
        channel: args.channel,
        message: args.message,
        messageType: args.type,
        timeout: args.timeout
      })
      return
    }
    frontend(cabals)
    setTimeout(() => {
      cabals.forEach((cabal) => {
        swarm(cabal)
      })
    }, 300)
  } else {
    cabals.forEach((cabal) => {
      console.log('Seeding', cabal.key)
      swarm(cabal)
    })
  }
}

function publishSingleMessage ({channel, message, messageType, timeout}) {
  console.log('Publishing message to channel - ' + channel + ': "' + message + '"...')
  cabal.publish({
    type: messageType || 'chat/text',
    content: {
      channel: channel || 'default',
      text: message
    }
  })
  swarm(cabal)
  setTimeout(function () { process.exit(0) }, timeout || 5000)
}
