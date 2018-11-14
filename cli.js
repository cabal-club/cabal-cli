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
var chalk = require("chalk")

var args = minimist(process.argv.slice(2))

var homedir = os.homedir()
var rootdir = args.dir || (homedir + `/.cabal/v${Cabal.databaseVersion}`)
var archivesdir = `${rootdir}/archives/`

var usage = `Usage

  cabal 
  cabal cabal://key
  cabal <your saved --alias of a cabal>

  OR

  cabal --new

  Options:

    --seed    Start a headless seed for the specified cabal key

    --new     Start a new cabal
    --nick    Your nickname
    --alias   Save an alias for the specified cabal, use with --key
    --key     Specify a cabal key. Used with --alias
    --join    Only join the specified cabal, disregarding whatever is in the config
    --message Publish a single message; then quit after \`timeout\`
    --channel Channel name to publish to for \`message\` option; default: "default"
    --timeout Delay in milliseconds to wait on swarm before quitting for \`message\` option; default: 5000
    --type    Message type set to message for \`message\` option; default: "chat/text"

Work in progress! Learn more at github.com/cabal-club
`

var cabalKeys = []
var config = {aliases: {}, cabals: []}
var configFilePath = findConfigPath()

// make sure the config folder exists
mkdirp.sync(rootdir)

// Attempt to load local or homedir config file
try {
  if (configFilePath) {
    config = yaml.safeLoad(fs.readFileSync(configFilePath, 'utf8'))
    if (config && config.cabals) {
      cabalKeys = config.cabals
    }
  }
} catch (e) {
  logError(e)
}

if (args.alias && !args.key) {
    logError("the --alias option needs to be used together with --key")
    process.exit(1) 
}

// user wants to alias a cabal:// key with a name
if (args.alias && args.key) {
    config.aliases[args.alias] = args.key
    saveConfig(configFilePath, config)
    console.log(`${chalk.magentaBright("cabal:")} saved ${chalk.greenBright(args.key)} as ${chalk.blueBright(args.alias)}`)
    process.exit(0)
    return
}

if (args.key) {
  // If a key is provided, place it at the top of the list
  cabalKeys.unshift(args.key)
} else if (args._.length > 0) {
    // the cli was run as `cabal <alias|key> ... <alias|key>`
    args._.forEach(function (str) {
        cabalKeys.unshift(getKey(str))
    })
}

// disregard config
if (args.join) {
    cabalKeys = [getKey(args.join)]
}

// create and join a new cabal
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
  // join the specified list of cabals
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

    var dbVersion = Cabal.databaseVersion
    frontend({
      archivesdir,
      cabals,
      configFilePath,
      homedir,
      dbVersion,
      config,
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

function getKey(str) {
    // return key if what was passed in was a saved alias
    if (str in config.aliases) { return config.aliases[str] }
    // else assume it's a cabal key
    return str
}

function logError(msg) {
    console.error(`${chalk.red("cabal:")} ${msg}`)
}

function findConfigPath () {
  var configFilename = 'config.yml'
  var currentDirConfigFilename = '.cabal.yml'
  if (args.config && fs.existsSync(args.config)) {
    return args.config
  } else if (fs.existsSync(currentDirConfigFilename)) {
    return currentDirConfigFilename
  } else if (fs.existsSync(rootdir + '/' + configFilename)) {
    return rootdir + '/' + configFilename
  }
    return currentDirConfigFilename
}

function saveConfig(path, config) {
    let data = yaml.safeDump(config, {
        sortKeys: true
    })
    fs.writeFileSync(path, data, 'utf8')
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
