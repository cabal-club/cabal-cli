#!/usr/bin/env node
var Cabal = require('cabal-core')
var swarm = require('cabal-core/swarm.js')
var minimist = require('minimist')
var os = require('os')
var fs = require('fs')
var yaml = require('js-yaml')
var mkdirp = require('mkdirp')
var frontend = require('./neat-screen.js')
var crypto = require('hypercore-crypto')

var args = minimist(process.argv.slice(2))

var protocolMajorVersion = Cabal.protocolVersion.split('.')[0]
var homedir = os.homedir()
var rootdir = args.dir || (homedir + `/.cabal/v${protocolMajorVersion}`)
var archivesdir = `${rootdir}/archives/`

var usage = `Usage

  cabal --key cabal://key

  OR

  cabal --new

  Options:

    --seed    Start a headless seed for the specified cabal key

    --nick    Your nickname
    --new     Start a new cabal
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
  var configFilePath
  var configFilename = 'config.yml'
  var currentDirConfigFilename = '.cabal.yml'
  mkdirp.sync(rootdir)
  if (args.config && fs.existsSync(args.config)) {
    configFilePath = args.config
  } else if (fs.existsSync(currentDirConfigFilename)) {
    configFilePath = currentDirConfigFilename
  } else if (fs.existsSync(rootdir + '/' + configFilename)) {
    configFilePath = rootdir + '/' + configFilename
  }
  if (configFilePath) {
    config = yaml.safeLoad(fs.readFileSync(configFilePath, 'utf8'))
    if (config && config.cabals) {
      cabalKeys = config.cabals
    }
  }
} catch (e) {
  console.log(e)
}

if (args.key) {
  // If a key is provided, place it at the top of the list
  cabalKeys.unshift(args.key)
}

if (args.new) {
  var key = crypto.keyPair().publicKey.toString('hex')
  var db = archivesdir + key
  var cabal = Cabal(db, key)
  cabal.db.ready(function () {
    if (!args.seed) {
      start([cabal])
    }
  })
} else if (cabalKeys.length) {
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
} else {
  process.stderr.write(usage)
  process.exit(1)
}

function start (cabals) {
  if (!args.seed) {
    if (args.key && args.message) {
      publishSingleMessage({
        key: args.key,
        channel: args.channel,
        message: args.message,
        messageType: args.type,
        timeout: args.timeout
      })
      return
    }
    frontend({
      archivesdir,
      cabals,
      configFilePath,
      homedir,
      protocolMajorVersion,
      rootdir
    })
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

function publishSingleMessage ({key, channel, message, messageType, timeout}) {
  console.log(`Publishing message to channel - ${channel || 'default'}: ${message}`)
  var cabal = Cabal(archivesdir + key, key)
  cabal.db.ready(() => {
    cabal.publish({
      type: messageType || 'chat/text',
      content: {
        channel: channel || 'default',
        text: message
      }
    })
    swarm(cabal)
    setTimeout(function () { process.exit(0) }, timeout || 5000)
  })
}
