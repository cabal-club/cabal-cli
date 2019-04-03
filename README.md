# cabal-cli

> Terminal client for cabal, the p2p chat platform.

See [cabal-core](https://github.com/cabal-club/cabal-core) for the underlying
database & api.

![](https://i.cblgh.org/2018-05/2466txd.png)

chat with us:  
`npx cabal --key cabal://14bc77d788fdaf07b89b28e9d276e47f2e44011f4adb981921056e1b3b40e99e`

## Installation

```
$ npm install --global cabal
$ cabal --key cabal://14bc77d788fdaf07b89b28e9d276e47f2e44011f4adb981921056e1b3b40e99e
```

## Usage
#### Start a new instance:
```
cabal --new
```

#### Connect to an existing instance:
```
cabal --key <key>
```
e.g.
```
cabal --key cabal://14bc77d788fdaf07b89b28e9d276e47f2e44011f4adb981921056e1b3b40e99e
```

#### Headless mode

This will run cabal without a UI. You can use this to seed a cabal (e.g. on a VPS) and make its data more available:
```
cabal --key <key> --seed
```

## Commands
```
/channels 
   display channels you can join
/names
   display a list of the people currently online 
/join <channel> 
   join a channel
/j
   alias for /join
/nick <new nick>
   pick a new username
/n
   alias for /nick
/emote <some text> 
   write an old-school text emote
/me
   alias for /emote
/clear
   clear the current backlog
/help
    display a help message of the current commands
/quit
   exit cabal
```

## Hotkeys
`ctrl+u`  
&nbsp;&nbsp;&nbsp;&nbsp;clear input line  
`ctrl+w`  
&nbsp;&nbsp;&nbsp;&nbsp;delete last word in input  
`up-arrow`  
&nbsp;&nbsp;&nbsp;&nbsp;cycle through command history  
`down-arrow`  
&nbsp;&nbsp;&nbsp;&nbsp;cycle through command history  
`home`  
&nbsp;&nbsp;&nbsp;&nbsp;go to start of input line  
`end`  
&nbsp;&nbsp;&nbsp;&nbsp;go to end of input line  
`ctrl+n`  
&nbsp;&nbsp;&nbsp;&nbsp;go to next channel  
`ctrl+p`  
&nbsp;&nbsp;&nbsp;&nbsp;go to previous channel  
`pageup`  
&nbsp;&nbsp;&nbsp;&nbsp;scroll up through backlog  
`pagedown`  
&nbsp;&nbsp;&nbsp;&nbsp;scroll down through backlog  
`alt-[1,9]`  
&nbsp;&nbsp;&nbsp;&nbsp;select channels  1-9  
`alt-n`
&nbsp;&nbsp;&nbsp;&nbsp;tab between the cabals & channels panes 
