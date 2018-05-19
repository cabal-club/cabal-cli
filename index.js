var Cabal = require('../cabal-club/cabal-node/index.js')
var cabalSwarm = require('../cabal-club/cabal-node/swarm.js')
var frontend = require('./neat-screen.js')
var minimist = require('minimist')

var args = minimist(process.argv.slice(2))

if (!args.db) {
  if (args.key) {
    args.db = 'archives/' + args.key
  } else {
    console.error('error: need --db flag!\nexamples:\n\tnode index.js --db <your-new-db-file>\n\tnode index.js --db my.db')
    process.exit(1)
  }
}

var cabal = Cabal(args.db, args.key, {username: args.nick || 'conspirator'})
cabal.db.on('ready', function () {
  frontend(cabal)
  var swarm = cabalSwarm(cabal)
})
