# Cabal
p2p forum software

cabal is a place where mesh conspirators can talk about p2p topics in a p2p way   

see [cabal-node](https://github.com/cabal-club/cabal-node) for the underlying database & api

![](https://i.cblgh.org/2018-05/2466txd.png)

come talk to us in `dat://5fb497e58d2701e173f5a270dfff77ac516ec09289426519d0098209bf4e8954`
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
node cli.js --key dat://5fb497e58d2701e173f5a270dfff77ac516ec09289426519d0098209bf4e8954
 --nick voynich

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
