var hyperdb = require("hyperdb")
var discovery = require("discovery-swarm")
var swarmDefaults = require("dat-swarm-defaults")
var readInput = require("./input.js")
var minimist = require("minimist")

var args = minimist(process.argv.slice(2))

if (!args.db) {
    console.error("error: need --db flag!\nexamples:\n\tnode index.js --db <your-new-db-file>\n\tnode index.js --db my.db")
    return
}

// TODO:
// * watch substack talk on streams
// * go through stream tutorial
// * implement chat command
//   * /chat/default/latest
//   * /chat/default/<vectorTime>
// * remove reduce when chat works

var disableAutoAuth = args.noautoauth ? true : false
var nick = args.nick || "conspirator"
console.log("auto authorization is:", disableAutoAuth ? "off" : "on")

var json = {
    encode: (i) => Buffer.from(JSON.stringify(i)),
    decode: (buf) => {
        var str = buf.toString("utf8")
        try { var obj = JSON.parse(str) }
        catch (err) { return {} }
        return obj
    }
}

// check if args.key was provided in the cli using --key
var db = args.key ? 
    // join an existing hyperdb where args.key comes from providing index.js with --key <key>
    hyperdb(args.db, args.key, { valueEncoding: json, reduce: (a, b) => a }) :
    // or create a new original hyperdb, by not specifying a key
    hyperdb(args.db, { valueEncoding: json, reduce: (a, b) => a })

db.on("ready", function() {
    console.log("db ready!\ndb key is\n\t", db.key.toString("hex"))
    console.log("local key is\n\t", db.local.key.toString("hex"))
    readInput(db, nick)
    var swarm = setupSwarm(db)
})

// join a discovery swarm, connecting this hyperdb instance with others over DHT & DNS
// this step is essential to have your database changes propagate between your db and that of others
function setupSwarm(db) {
    var dbstr = db.key.toString("hex")
    var swarm = discovery(swarmDefaults({
        id: dbstr,
        stream: function(peer) {
            return db.replicate({ // TODO: figure out what this truly does
                live: true,
                userData: JSON.stringify({key: db.local.key, nick: nick})
            }) 
        }
    }))
    console.log("looking for peers using swarm id\n\t", dbstr)

    swarm.join(dbstr)

    // emitted when a new peer joins 
    swarm.on("connection", (peer) => {
        if (disableAutoAuth) {
            return
        }
        // initiate auto-authorization: 
        // use the local key from the peer, stored in their userData, to authenticate them automatically
        // (thanks substack && JimmyBoh https://github.com/karissa/hyperdiscovery/pull/12#pullrequestreview-95597621 )
        if (!peer.remoteUserData) {
            console.log("peer missing user data")
            return
        }
        try {
            var obj = JSON.parse(peer.remoteUserData)
            var remotePeerKey = Buffer.from(obj.key, "hex")
        }
        catch (err) { console.error(err); return }

        db.authorized(remotePeerKey, function (err, auth) {
            console.log(remotePeerKey.toString("hex"), "authorized? " + auth)
            if (err) return console.log(err)
            if (!auth) db.authorize(remotePeerKey, function (err) {
                if (err) return console.log(err)
                console.log(remotePeerKey.toString("hex"), "was just authorized!")
            })
        })
    })
    // return the swarm instance
    return swarm
}
