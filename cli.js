#!/usr/bin/env node
var Cabal = require('cabal-node')
var cabalSwarm = require('cabal-node/swarm.js')
var frontend = require('./neat-screen.js')
var minimist = require('minimist')

var args = minimist(process.argv.slice(2))

var usage = `Usage

  cabal --key dat://key

  OR

  cabal --db /path/to/db

  Options:

    --nick    Your nickname.

Work in progress! Learn more at github.com/cabal-club
`

if (args.key) {
  args.db = 'archives/' + args.key
}

if (!args.db) {
  process.stderr.write(usage)
  process.exit(1)
}

var cabal = Cabal(args.db, args.key, {username: args.nick || 'conspirator'})
cabal.db.on('ready', function () {
  frontend(cabal)
  var swarm = cabalSwarm(cabal)
})
