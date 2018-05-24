# Cabal
p2p forum software

cabal is a place where mesh conspirators can talk about p2p topics in a p2p way   

see [cabal-node](https://github.com/cabal-club/cabal-node) for the underlying database & api

![](https://i.cblgh.org/2018-05/2466txd.png)

come talk to us in `dat://21b2b9ff201b01e6081709d82e6b81a5cf3a68d2cd5f092d0ffec58772642892`
## Usage
Start a new instance:
```
node cli.js --db <file path> --nick <nickname>
```

Connect to an existing instance:
```
node cli.js --key <key> --nick <nickname>
```
e.g.
```
node cli.js --key dat://21b2b9ff201b01e6081709d82e6b81a5cf3a68d2cd5f092d0ffec58772642892 --nick voynich

```

## Commands
```
/channels 
   display channels you can join
/change <channel> 
   change channels
/nick <new nick>
   pick a new username
/clear
   clear the current backlog
/quit
   exit cabal
```
