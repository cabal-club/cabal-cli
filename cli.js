#!/usr/bin/env node
var Cabal = require('cabal-core')
var swarm = require('cabal-core/swarm.js')
var minimist = require('minimist')
var os = require('os')
var fs = require('fs')
var yaml = require('js-yaml')
var mkdirp = require('mkdirp')

var frontend = require('./neat-screen.js')

var args = minimist(process.argv.slice(2))

var homedir = os.homedir()
var rootdir = args.dir || (homedir + `/.cabal/${Cabal.protocolVersion}`)
var archivesdir = `${rootdir}/archives/`

var usage = `Usage

  cabal --key cabal://key

  OR

  cabal --db /path/to/db

  Options:

    --seed    Start a headless seed for the specified cabal key

    --nick    Your nickname
    --message Publish a single message; then quit after \`timeout\`
    --channel Channel name to publish to for \`message\` option; default: "default"
    --timeout Delay in milliseconds to wait on swarm before quitting for \`message\` option; default: 5000
    --type    Message type set to message for \`message\` option; default: "chat/text"

Work in progress! Learn more at github.com/cabal-club
`

var cabalKeys = []

// Attempt to load local or homedir config file
try {
  var config
  var configFilename = 'config.yml'
  var currentDirConfigFilename = '.cabal.yml'
  mkdirp.sync(rootdir)
  if (args.config && fs.existsSync(args.config)) {
    config = yaml.safeLoad(fs.readFileSync(args.config, 'utf8'))
  } else if (fs.existsSync(currentDirConfigFilename)) {
    config = yaml.safeLoad(fs.readFileSync(currentDirConfigFilename, 'utf8'))
  } else if (fs.existsSync(rootdir + '/' + configFilename)) {
    config = yaml.safeLoad(fs.readFileSync(rootdir + '/' + configFilename, 'utf8'))
  }
  if (config && config.cabals) {
    cabalKeys = config.cabals
  }
} catch (e) {
  console.log(e)
}

if (args.key) {
  // If a key is provided, place it at the top of the list
  cabalKeys.unshift(args.key)
}

if (cabalKeys.length) {
  Promise.all(cabalKeys.map((key) => {
    key = key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
    var db = archivesdir + key
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
  var cabal = Cabal(args.db, null)
  cabal.publishNick(args.nick)
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

function start (cabals) {
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
