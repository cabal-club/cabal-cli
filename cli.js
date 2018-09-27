#!/usr/bin/env node
var Cabal = require('cabal-core')
var swarm = require('cabal-core/swarm.js')
var minimist = require('minimist')
var frontend = require('./neat-screen.js')

var args = minimist(process.argv.slice(2))

var homedir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
var rootdir = homedir + '/.cabal/archives/'

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

if (args.key) {
  args.key = args.key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
  args.db = rootdir + args.key

  var cabal = Cabal(args.db, args.key)
  cabal.db.ready(function () {
    start(args.key)
  })
} else {
  cabal = Cabal(args.db, null)
  cabal.db.ready(function () {
    cabal.getLocalKey(function (err, key) {
      if (err) throw err
      start(key)
    })
  })
}

if (!args.db) {
  process.stderr.write(usage)
  process.exit(1)
}

function start (key) {
  if (!args.seed) {
    if (args.message) {
      publishSingleMessage({
        channel: args.channel,
        message: args.message,
        messageType: args.type,
        timeout: args.timeout
      })
      return
    }
    frontend(cabal)
    setTimeout(function () { swarm(cabal) }, 300)
  } else {
    console.log('Seeding', key)
    swarm(cabal)
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
