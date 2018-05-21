# Cabal
p2p forum software

cabal is a place where mesh conspirators can talk about p2p topics in a p2p way   

see [cabal-node](https://github.com/cabal-club/cabal-node) for the underlying database & api

![](https://i.cblgh.org/2018-05/2466txd.png)
## Usage
Start a new instance:
```
node cli.js --db <file path> --nick <nickname>
```

Connect to an existing instance:
```
node cli.js --key <key> --nick <nickname>
```

## Commands
```
/list 
   display a channel listing
/change <channel> 
   change channels
/nick <new nick>
   pick a new username
/clear
   clear the current backlog
/quit
   exit cabal
```
