# Cabal
p2p forum software

cabal is a place where mesh conspirators can talk about p2p topics in a p2p way   

see [cabal-node](https://github.com/cabal-club/cabal-node) for the underlying database & api

![](https://i.cblgh.org/2018-05/2466txd.png)

chat with us:  
`npx cabal --key dat://21b2b9ff201b01e6081709d82e6b81a5cf3a68d2cd5f092d0ffec58772642892`
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
node cli.js --key dat://21b2b9ff201b01e6081709d82e6b81a5cf3a68d2cd5f092d0ffec58772642892 --nick voynich

```

#### Reseed a cabal instance, headlessly (e.g. on a VPS):
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
