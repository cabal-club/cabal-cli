# Cabal
p2p chat software

cabal is a place where mesh conspirators can talk about p2p topics in a p2p way   

see [cabal-node](https://github.com/cabal-club/cabal-node) for the underlying database & api

![](https://i.cblgh.org/2018-05/2466txd.png)

chat with us:  
`npx cabal --key dat://59813e3169b4b2a6d3741b077f80cce014d84d67b4a8f9fa4c19605b5cff637f`
## Usage
#### Start a new instance:
```
node cli.js --db <file path> --nick <nickname>
```

#### Connect to an existing instance:
```
node cli.js --key <key> --nick <nickname>
```
e.g.
```
node cli.js --key dat://59813e3169b4b2a6d3741b077f80cce014d84d67b4a8f9fa4c19605b5cff637f --nick voynich

```

#### Headless mode

This will run cabal without a UI. You can use this to seed a cabal (e.g. on a VPS) and make its data more available:
```
node cli.js --key <key> --seeder
```

## Commands
```
/channels 
   display channels you can join
/names
    display a list of the people currently online 
/join <channel> 
   join a channel
/nick <new nick>
   pick a new username
/clear
   clear the current backlog
/debug <key>
    debug the underlying hyperdb's keys
/help
    display a help message of the current commands
/quit
   exit cabal
```
