#!/usr/bin/env node
var Client = require('cabal-client')
var minimist = require('minimist')
var fs = require('fs')
var path = require('path')
var yaml = require('js-yaml')
var mkdirp = require('mkdirp')
var frontend = require('./neat-screen.js')
var chalk = require('chalk')
var captureQrCode = require('node-camera-qr-reader')

var args = minimist(process.argv.slice(2))

var rootdir = Client.getCabalDirectory()
var rootconfig = `${rootdir}/config.yml`
var archivesdir = `${rootdir}/archives/`

var usage = `Usage

  Create a new cabal:
    cabal --new

  Join a cabal by its key:
    cabal cabal://key

  Join a cabal by an alias:
    cabal <your saved --alias of a cabal>

  Join a cabal by a QR code:
    cabal --qr

  Options:
    --seed    Start a headless seed for the specified cabal key

    --new     Start a new cabal
    --nick    Your nickname
    --alias   Save an alias for the specified cabal, use with --key
    --aliases Print out your saved cabal aliases
    --forget  Forgets the specified alias
    --clear   Clears out all aliases
    --key     Specify a cabal key. Used with --alias
    --join    Only join the specified cabal, disregarding whatever is in the config
    --config  Specify a full path to a cabal config
    --qr      Capture a frame from a connected camera to read a cabal key from a QR code

    --temp    Start the cli with a temporary in-memory database. Useful for debugging
    --version Print out which version of cabal you're running
    --help    Print this help message

    --message Publish a single message; then quit after \`timeout\`
    --channel Channel name to publish to for \`message\` option; default: "default"
    --timeout Delay in milliseconds to wait on swarm before quitting for \`message\` option; default: 5000
    --type    Message type set to message for \`message\` option; default: "chat/text"

Work in progress! Learn more at https://github.com/cabal-club
`

if (args.version || args.v) {
  console.log(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version)
  process.exit(0)
}

if (args.help || args.h) {
  process.stderr.write(usage)
  process.exit(1)
}

var config
var cabalKeys = []
var configFilePath = findConfigPath()
var maxFeeds = 1000

// make sure the .cabal/v<databaseVersion> folder exists
mkdirp.sync(rootdir)

// create a default config in rootdir if it doesn't exist
if (!fs.existsSync(rootconfig)) {
  saveConfig(rootconfig, { cabals: [], aliases: {}, cache: {} })
}

// Attempt to load local or homedir config file
try {
  if (configFilePath) {
    config = yaml.safeLoad(fs.readFileSync(configFilePath, 'utf8'))
    if (!config.cabals) { config.cabals = [] }
    if (!config.aliases) { config.aliases = {} }
    if (!config.cache) { config.cache = {} }
    cabalKeys = config.cabals
  }
} catch (e) {
  logError(e)
  process.exit(1)
}

const client = new Client({
  maxFeeds: maxFeeds,
  config: {
    dbdir: archivesdir,
    temp: args.temp
  },
  persistentCache: {
    read: async function (name, err) {
      if (name in config.cache) {
        var cache = config.cache[name]
        if (cache.expiresAt < Date.now()) { // if ttl has expired: warn, but keep using
          console.error(`${chalk.redBright('Note:')} the TTL for ${name} has expired`)
        }
        return cache.key
      }
      // dns record wasn't found online and wasn't in the cache
      return null
    },
    write: async function (name, key, ttl) {
      var expireOffset = +(new Date(ttl * 1000)) // convert to epoch time
      var expiredTime = Date.now() + expireOffset
      if (!config.cache) config.cache = {}
      config.cache[name] = { key: key, expiresAt: expiredTime }
      saveConfig(configFilePath, config)
    }
  }
})

if (args.clear) {
  delete config['aliases']
  saveConfig(configFilePath, config)
  process.stdout.write('Aliases cleared\n')
  process.exit(0)
}

if (args.forget) {
  delete config.aliases[args.forget]
  saveConfig(configFilePath, config)
  process.stdout.write(`${args.forget} has been forgotten`)
  process.exit(0)
}

if (args.aliases) {
  var aliases = Object.keys(config.aliases)
  if (aliases.length === 0) {
    process.stdout.write("You don't have any saved aliases.\n\n")
    process.stdout.write(`Save an alias by running\n`)
    process.stdout.write(`${chalk.magentaBright('cabal: ')} ${chalk.greenBright('--alias cabal://c001..c4b41')} `)
    process.stdout.write(`${chalk.blueBright('--key your-alias-name')}\n`)
  } else {
    aliases.forEach(function (alias) {
      process.stdout.write(`${chalk.blueBright(alias)}\t\t ${chalk.greenBright(config.aliases[alias])}\n`)
    })
  }
  process.exit(0)
}

if (args.alias && !args.key) {
  logError('the --alias option needs to be used together with --key')
  process.exit(1)
}

// user wants to alias a cabal:// key with a name
if (args.alias && args.key) {
  config.aliases[args.alias] = args.key
  saveConfig(configFilePath, config)
  console.log(`${chalk.magentaBright('cabal:')} saved ${chalk.greenBright(args.key)} as ${chalk.blueBright(args.alias)}`)
  process.exit(0)
}

if (args.key) {
  // If a key is provided, place it at the top of the keys provided from the config
  cabalKeys.unshift(args.key)
} else if (args.temp && args.temp.length > 0) {
  // don't eat the key if it was passed in as `cabal --temp <key>`
  cabalKeys = [args.temp]
} else if (args._.length > 0) {
  // the cli was run as `cabal <alias|key> ... <alias|key>`
  // replace keys from config with the keys from the args
  cabalKeys = args._.map(getKey)
}

// disregard config
if (args.join) {
  cabalKeys = [getKey(args.join)]
}

if (!cabalKeys.length) {
  process.stderr.write(usage)
  process.exit(1)
} else {
  if (args.qr) {
    console.log('Cabal is looking for a QR code...')
    console.log('Press ctrl-c to stop.')
    captureQrCode({ retry: true }).then((key) => {
      if (key) {
        console.log('\u0007') // system bell
        start([key])
      } else {
        console.log('No QR code detected.')
        process.exit(0)
      }
    })
      .catch((e) => {
        console.error('Webcam capture failed. Have you installed the appropriate drivers? See the documentation for more information.')
        console.error('Mac OSX: brew install imagesnap')
        console.error('Linux: sudo apt-get install fswebcam')
      })
  } else {
    start(cabalKeys)
  }
}

function start (keys) {
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
  keys = Array.from(new Set(keys)) // remove duplicates

  // => remembers the latest cabal, allows joining latest with `cabal`
  if (!args.join || !args.new) {
    config.cabals = keys
    saveConfig(configFilePath, config)
  }

  var pendingCabals = args.new ? [ client.createCabal() ] : keys.map(client.addCabal.bind(client))
  Promise.all(pendingCabals).then(() => {
    if (args.new) {
      console.error(`created the cabal: ${chalk.greenBright('cabal://' + client.getCurrentCabal().key)}`) // log to terminal output (stdout is occupied by interface)
      keys = [client.getCurrentCabal().key]
    }
    if (!args.seed) { frontend({ client }) } else {
      keys.forEach((k) => {
        console.log('Seeding', k)
        console.log()
        console.log('@: new peer')
        console.log('x: peer left')
        console.log('^: uploaded a chunk')
        console.log('.: downloaded a chunk')
        console.log()
        trackAndPrintEvents(client._getCabalByKey(k))
      })
    }
  }).catch((e) => {
    if (e) { console.error(e) } else { console.error("Error: Couldn't resolve one of the following cabal keys:", chalk.yellow(keys.join(' '))) }
    process.exit(1)
  })
}

function trackAndPrintEvents (cabal) {
  cabal.ready(() => {
    // Listen for feeds
    cabal.kcore._logs.feeds().forEach(listen)
    cabal.kcore._logs.on('feed', listen)

    function listen (feed) {
      feed.on('download', idx => {
        process.stdout.write('.')
      })
      feed.on('upload', idx => {
        process.stdout.write('^')
      })
    }

    cabal.on('peer-added', () => {
      process.stdout.write('@')
    })

    cabal.on('peer-dropped', () => {
      process.stdout.write('x')
    })
  })
}

function getKey (str) {
  // return key if what was passed in was a saved alias
  if (str in config.aliases) { return config.aliases[str] }
  // else assume it's a cabal key
  return str
}

function logError (msg) {
  console.error(`${chalk.red('cabal:')} ${msg}`)
}

function findConfigPath () {
  var currentDirConfigFilename = '.cabal.yml'
  if (args.config && fs.existsSync(args.config)) {
    return args.config
  } else if (fs.existsSync(currentDirConfigFilename)) {
    return currentDirConfigFilename
  }
  return rootconfig
}

function saveConfig (path, config) {
  // make sure config is well-formatted (contains all config options)
  if (!config.cabals) { config.cabals = [] }
  if (!config.aliases) { config.aliases = {} }
  let data = yaml.safeDump(config, {
    sortKeys: true
  })
  fs.writeFileSync(path, data, 'utf8')
}

function publishSingleMessage ({key, channel, message, messageType, timeout}) {
  console.log(`Publishing message to channel - ${channel || 'default'}: ${message}`)
  client.addCabal(key).then(cabal => cabal.publishMessage({
    type: messageType || 'chat/text',
    content: {
      channel: channel || 'default',
      text: message
    }
  })
  )
  setTimeout(function () { process.exit(0) }, timeout || 5000)
}
