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
var fe = null

var args = minimist(process.argv.slice(2))
const version = getClientVersion()

// set terminal window title
process.stdout.write('\x1B]0;cabal\x07')

var rootdir = null
if (args.config && fs.statSync(args.config).isDirectory()) {
  rootdir = path.join(args.config, `v${Client.getDatabaseVersion()}`)
} else if (args.config) {
  rootdir = path.join(
    path.dirname(path.resolve(args.config)),
    `v${Client.getDatabaseVersion()}`
  )
} else {
  rootdir = Client.getCabalDirectory()
}

var rootconfig = `${rootdir}/config.yml`
var archivesdir = `${rootdir}/archives/`

const defaultMessageTimeformat = '%T'
const defaultMessageIndent = 'nick'

var usage = `Usage
  Create a new cabal:
    cabal --new

  Create a new cabal and name it locally:
    cabal --new --alias <name>

  Join a cabal by its key:
    cabal cabal://key

  Join a cabal by an alias:
    cabal <your saved --alias of a cabal>

  Save a cabal, adding it to the list of cabals to autojoin:
    cabal --save cabal://key

  Join all of your saved cabals by running just \`cabal\`:
    cabal

  Join a cabal by a QR code:
    cabal --qr

  Options:
    --seed    Start a headless seed for the specified cabal key

    --new     Start a new cabal
    --nick    Your nickname
    --alias   Save an alias for the specified cabal. Used with --key.
                --alias <name> --key <cabal>
    --aliases Print out your saved cabal aliases
    --cabals  Print out your saved cabals
    --forget  Forgets the specified cabal. Works on aliases and keys persisted with --save
    --clear   Clears out all aliases
    --save    Save the specified cabal to the config
                --save <cabal>
    --key     Specify a cabal key. Used with --alias.
                --alias <name> --key <cabal>
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
  console.log(version)
  process.exit(0)
}

if (args.help || args.h) {
  process.stderr.write(usage)
  process.exit(1)
}

var config
var cabalKeys = []
var configFilePath = findConfigPath()
mkdirp.sync(path.dirname(configFilePath))
var maxFeeds = 1000

// make sure the .cabal/v<databaseVersion> folder exists
mkdirp.sync(rootdir)

// create a default config in rootdir if it doesn't exist
if (!fs.existsSync(rootconfig)) {
  saveConfig(rootconfig, {
    cabals: [],
    aliases: {},
    cache: {},
    frontend: {
      messageTimeformat: defaultMessageTimeformat,
      messageIndent: defaultMessageIndent
    }
  })
}

// Attempt to load local or homedir config file
try {
  if (configFilePath) {
    if (fs.existsSync(configFilePath)) {
      config = yaml.safeLoad(fs.readFileSync(configFilePath, 'utf8'))
    } else {
      config = {}
    }
    if (!config.cabals) { config.cabals = [] }
    if (!config.aliases) { config.aliases = {} }
    if (!config.cache) { config.cache = {} }
    if (!config.frontend) { config.frontend = {} }
    if (!config.frontend.messageTimeformat) {
      config.frontend.messageTimeformat = defaultMessageTimeformat
    }
    if (!config.frontend.messageIndent) {
      config.frontend.messageIndent = defaultMessageIndent
    }
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
  commands: {
    // todo: custom commands
    panes: {
      help: () => 'set pane to navigate up and down in. panes: channels, cabals',
      call: (cabal, res, arg) => {
        if (arg === '' || !['channels', 'cabals'].includes(arg)) return
        fe.setPane(arg)
      }
    },
    quit: {
      help: () => 'exit the cabal process',
      call: (cabal, res, arg) => {
        process.exit(0)
      }
    },
    exit: {
      help: () => 'exit the cabal process',
      call: (cabal, res, arg) => {
        process.exit(0)
      }
    },
    help: {
      help: () => 'display this help message',
      call: (cabal, res, arg) => {
        var foundAliases = {}
        for (var key in cabal.client.commands) {
          if (foundAliases[key]) { continue }
          const slash = chalk.gray('/')
          let command = key
          if (cabal.client.aliases[key]) {
            foundAliases[cabal.client.aliases[key]] = true
            command += `, ${slash}${cabal.client.aliases[key]}`
          }
          fe.writeLine(`${slash}${command}`)
          fe.writeLine(`  ${cabal.client.commands[key].help()}`)
        }
        fe.writeLine('alt-n')
        fe.writeLine('  move between channels/cabals panes')
        fe.writeLine('ctrl+{n,p}')
        fe.writeLine('  move up/down channels/cabals')
      }
    }
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
  delete config.aliases
  saveConfig(configFilePath, config)
  process.stdout.write('Aliases cleared\n')
  process.exit(0)
}

if (args.forget) {
  let success = false
  /* eslint no-inner-declarations: "off" */
  function forgetCabal (k) {
    const index = config.cabals.indexOf(k)
    if (index >= 0) {
      config.cabals.splice(index, 1)
      success = true
    }
  }
  if (config.aliases[args.forget]) {
    const aliasedKey = config.aliases[args.forget]
    success = true
    delete config.aliases[args.forget]
    // forget any potential reuses of the aliased key in config.cabals array
    forgetCabal(aliasedKey)
  }
  // check if key is among saved cabals
  if (!success) forgetCabal(args.forget)
  if (success) {
    saveConfig(configFilePath, config)
    console.log(`${args.forget} has been forgotten`)
  } else { console.log('no such cabal') }
  process.exit(0)
}

if (args.aliases) {
  var aliases = Object.keys(config.aliases)
  if (aliases.length === 0) {
    process.stdout.write("You don't have any saved aliases.\n\n")
    process.stdout.write('Save an alias by running\n')
    process.stdout.write(`${chalk.magentaBright('cabal: ')} ${chalk.greenBright('--key cabal://c001..c4b41')} `)
    process.stdout.write(`${chalk.blueBright('--alias your-alias-name')}\n`)
  } else {
    aliases.forEach(function (alias) {
      process.stdout.write(`${chalk.blueBright(alias)}\t\t ${chalk.greenBright(config.aliases[alias])}\n`)
    })
  }
  process.exit(0)
}

if (args.cabals) {
  var savedCabals = config.cabals
  if (savedCabals.length === 0) {
    process.stdout.write("You don't have any saved cabals.\n\n")
    process.stdout.write('Save a cabal by running\n')
    process.stdout.write(`${chalk.magentaBright('cabal: ')} ${chalk.greenBright('--save cabal://c001..c4b41')} `)
  } else {
    savedCabals.forEach(function (saved) {
      process.stdout.write(`${chalk.greenBright(saved)}\n`)
    })
  }
  process.exit(0)
}

if (args.alias && !args.new && !args.key) {
  logError('the --alias option needs to be used together with --key')
  process.exit(1)
}

// user wants to alias a cabal:// key with a name
if (args.alias && args.key) {
  saveKeyAsAlias(args.key, args.alias)
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

// join and save the passed in cabal keys
if (args.save) {
  cabalKeys = args._.map(getKey)
  if (args.save.length > 0) cabalKeys = cabalKeys.concat(getKey(args.save))
  if (!cabalKeys.length) {
    console.log(`${chalk.magentaBright('cabal:')} error, need cabal keys to save. example:`)
    console.log(`${chalk.greenBright('cabal --save cabal://key')}`)
    process.exit(1)
  }

  config.cabals = config.cabals.concat(cabalKeys)
  saveConfig(configFilePath, config)
  // output message about keys having been saved
  if (cabalKeys.length === 1) {
    console.log(`${chalk.magentaBright('cabal:')} saved ${chalk.greenBright(cabalKeys[0])}`)
  } else {
    console.log(`${chalk.magentaBright('cabal:')} saved the following keys:`)
    cabalKeys.forEach((key) => { console.log(`${chalk.greenBright(key)}`) })
  }
  process.exit(0)
}

// try to initiate the frontend using either qr codes via webcam, using cabal keys passed via cli,
// or starting an entirely new cabal per --new
if (args.qr) {
  console.log('Cabal is looking for a QR code...')
  console.log('Press ctrl-c to stop.')
  captureQrCode({ retry: true }).then((key) => {
    if (key) {
      console.log('\u0007') // system bell
      start([key], config.frontend)
    } else {
      console.log('No QR code detected.')
      process.exit(0)
    }
  }).catch((e) => {
    console.error('Webcam capture failed. Have you installed the appropriate drivers? See the documentation for more information.')
    console.error('Mac OSX: brew install imagesnap')
    console.error('Linux: sudo apt-get install fswebcam')
  })
} else if (cabalKeys.length || args.new) {
  start(cabalKeys, config.frontend)
} else {
  // no keys, no qr, and not trying to start a new cabal => print help info
  process.stderr.write(usage)
  process.exit(1)
}

function start (keys, frontendConfig) {
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
  var pendingCabals = args.new ? [client.createCabal()] : keys.map(client.addCabal.bind(client))
  Promise.all(pendingCabals).then(() => {
    if (args.new) {
      console.error(`created the cabal: ${chalk.greenBright('cabal://' + client.getCurrentCabal().key)}`) // log to terminal output (stdout is occupied by interface)
      // allow saving newly created cabal as alias
      if (args.alias) { saveKeyAsAlias(client.getCurrentCabal().key, args.alias) }
      keys = [client.getCurrentCabal().key]
    }
    // edgecase: if the config is empty we remember the first joined cabals in it
    if (!config.cabals.length) {
      config.cabals = keys
      saveConfig(configFilePath, config)
    }
    if (args.nick && args.nick.length > 0) client.getCurrentCabal().publishNick(args.nick)
    if (!args.seed) {
      fe = frontend({ client, frontendConfig })
    } else {
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
  if (args.config && fs.statSync(args.config).isDirectory()) {
    return path.join(args.config, `v${Client.getDatabaseVersion()}`, 'config.yml')
  } else if (args.config && fs.existsSync(args.config)) {
    return args.config
  } else if (fs.existsSync(currentDirConfigFilename)) {
    return currentDirConfigFilename
  }
  return rootconfig
}

function saveConfig (path, config) {
  // make sure config is well-formatted (contains all config options)
  if (!config.cabals) { config.cabals = [] }
  config.cabals = Array.from(new Set(config.cabals)) // dedupe array entries
  if (!config.aliases) { config.aliases = {} }
  const data = yaml.safeDump(config, {
    sortKeys: true
  })
  fs.writeFileSync(path, data, 'utf8')
}

function saveKeyAsAlias(key, alias) {
  config.aliases[alias] = key
  saveConfig(configFilePath, config)
  console.log(`${chalk.magentaBright('cabal:')} saved ${chalk.greenBright(key)} as ${chalk.blueBright(alias)}`)
}

function publishSingleMessage ({ key, channel, message, messageType, timeout }) {
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

function getClientVersion () {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version
  } catch (e) {
    console.error('failed to read cabal\'s package.json -- something is wrong with your installation')
    process.exit(1)
  }
}
