#!/usr/bin/env node
var Cabal = require('cabal-node')
var cabalSwarm = require('cabal-node/swarm.js')
var minimist = require('minimist')
var frontend = require('./neat-screen.js')
var fs = require('fs')

var args = minimist(process.argv.slice(2))

var homedir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
var rootdir = homedir + '/.cabal/archives/'
var configPath = homedir + '/.cabal/config.json'

var usage = `Usage

  cabal --key dat://key

  OR

  cabal --db /path/to/db

  OR

  cabal youraliashere

  Options:

    --nick <name>         Use <name> as nick for this session
    --seeder              Start a headless seeder for the specified cabal key
    --set-alias <name>    Add an alias to your config. Must be used with --key
    --set-nick <name>  Set <name> as your default nick from now on

Work in progress! Learn more at github.com/cabal-club
`

function saveConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

var config
if (fs.existsSync(configPath)) {
  // load config
  try {
    config = JSON.parse(fs.readFileSync(configPath))
  } catch (SyntaxError) {
    process.stderr.write("Something is wrong with your config.\n")
  }
} else {
  // generate default config
  config = {
    keyAliases : {}
  }
  saveConfig(config)
}


var key = args.key || config.keyAliases[args._[0]]

if (key) {
  key = key.replace('dat://', '').replace(/\//g, '')
  args.db = rootdir + key
}

if (args['set-alias']) {
  if (args.key) {
    config.keyAliases[args['set-alias']] = args.key
    saveConfig(config)
    process.exit(0)
  } else {
    process.stderr.write(usage)
    process.exit(1)
  }
}

if (args['set-nick']) {
  config.nick = args['set-nick']
  saveConfig(config)
  if (!args.db) {
    process.exit(0)
  }
}

if (!args.db) {
  process.stderr.write(usage)
  process.exit(1)
}

var nick = args.nick || config.nick || (args.seeder ? 'cabal [seed]' : 'conspirator')
var cabal = Cabal(args.db, key, {username: nick})
cabal.db.on('ready', function () {
  if (!args.seeder) {
    frontend(cabal)
  } else {
    console.log('reseeding the cabal at dat://' + cabal.db.key.toString('hex'))
  }
  cabalSwarm(cabal)
})
