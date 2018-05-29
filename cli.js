#!/usr/bin/env node
var Cabal = require('cabal-node')
var swarm = require('cabal-node/swarm.js')
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

if (args.key) {
  args.key = args.key.replace('cabal://', '').replace('cbl://', '').replace('dat://', '').replace(/\//g, '')
  args.db = rootdir + args.key
}

if (!args.db) {
  process.stderr.write(usage)
  process.exit(1)
}

var nick = args.nick || (args.seeder ? 'cabal [seed]' : 'conspirator')
var cabal = Cabal(args.db, args.key, {username: nick})
cabal.db.on('ready', function () {
  if (!args.seeder) {
    frontend(cabal)
  } else {
    console.log('reseeding the cabal at cabal://' + cabal.db.key.toString('hex'))
  }
  cabalSwarm(cabal)
})
