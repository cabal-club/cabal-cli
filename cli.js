#!/usr/bin/env node
var Cabal = require('@noffle/cabal-core')
var swarm = require('@noffle/cabal-core/swarm.js')
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

    --nick    Your nickname.
    --seeder  Start a headless seeder for the specified cabal key

Work in progress! Learn more at github.com/cabal-club
`

var nick = args.nick || (args.seeder ? 'cabal [seed]' : 'conspirator')

if (args.key) {
  args.key = args.key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
  args.db = rootdir + args.key

  var cabal = Cabal(args.db, args.key, {username: nick})
  cabal.db.ready(function () {
    start(args.key)
  })
} else {
  var cabal = Cabal(args.db, null, {username: nick})
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
  if (!args.seeder) {
    frontend(cabal)
    setTimeout(function () { swarm(cabal) }, 300)
  } else {
    console.log('reseeding the cabal')
    swarm(cabal)
  }
}
