<!--
SPDX-FileCopyrightText: 2023 the cabal-club authors

SPDX-License-Identifier: AGPL-3.0-or-later
-->

# cable-cli

> Terminal client for cabal, the p2p chat platform.

**status**: Working proof of concept; not compatible with older versions of cabal (using a cabal-specific new wire protocol: [Cable](https://github.com/cabal-club/cable)).

See [cable-core](https://github.com/cabal-club/cable-core.js) and
[cable-client](https://github.com/cabal-club/cable-client.js) for the underlying database & api.

![](cli-2019-04.png)

<!--chat with us:
`npx cable-cli cabal://cabal.chat`
-->

## Installation

```
$ npm install --global cable-cli
$ cable-cli --new
```
If that fails the newest node is not yet supported by the stack. Try this:

Install [nvm](https://github.com/nvm-sh/nvm), open a new shell and run
```
$ nvm install 14    # or later node versions
$ npm install --global cable-cli
$ cable-cli --new
```

## Usage
#### Start a new instance:
```
cable-cli --new
```
then copy the key and give it to someone else.

#### Connect to an existing instance:
```
cable-cli <key>
```
e.g.
```
cable-cli cabal://0201400f1aa2e3076a3f17f4521b2cc41e258c446cdaa44742afe6e1b9fd5f82
```

#### Remember cabals for auto-joining
save a cabal to the config

```
cable-cli --save <key>
```

then connect to all of your saved cabals, by simply running `cabal`:

```
cable-cli
```

show saved cabals with `--cabals` and remove a saved cabal with `--forget`

```
cable-cli --cabals
cable-cli --forget <key|alias>
```

#### Save an alias to a key

create a local name for a key.

```
cable-cli --alias <name> --key <key>
cable-cli <name>
```


<!--

TODO (2023-09-26): the following sections need updating as cable-cli exits its proof of concept stage 
#### Headless mode

This will run cabal without a UI. You can use this to seed a cabal (e.g. on a VPS) and make its data more available:
```
cabal <key> --seed
```

#### Custom port
If you have a tightly configured firewall and need to port-forward a port, the default port Cabal uses is port `13331`.
You can change this with the `--port` flag, or setting `preferredPort` in your .cabal.yml config file.

```
cabal <key> --seed --port 7331
```
-->

## Commands
```py
/add, /cabal
  add a cabal
/new
  create a new cabal
/nick, /n
  change your display name
/emote, /me
  write an old-school text emote
/names
  display the names of the currently online peers
/channels
  display the cabal's channels
/panes
  set pane to navigate up and down in panes: channels, cabals
/join, /j
  join a new channel
/leave, /l
  leave a channel
/clear
  clear the current backscroll
/help
  display this help message
/qr
  generate a qr code with the current cabal's address
/quit, /exit
  exit the cabal process
/topic, /motd
  set the topic/description/message of the day for a channel
/whoami, /key
  display your local user key
/whois
  display the public keys associated with the passed in nick

alt-n
  move between channels/cabals panes
ctrl-{n,p}
  move up/down channels/cabals
```

## Hotkeys
`ctrl-l`  
&nbsp;&nbsp;&nbsp;&nbsp;redraw the screen  
`ctrl-u`  
&nbsp;&nbsp;&nbsp;&nbsp;clear input line  
`ctrl-w`  
&nbsp;&nbsp;&nbsp;&nbsp;delete last word in input  
`up-arrow`  
&nbsp;&nbsp;&nbsp;&nbsp;cycle through command history  
`down-arrow`  
&nbsp;&nbsp;&nbsp;&nbsp;cycle through command history  
`home`  
&nbsp;&nbsp;&nbsp;&nbsp;go to start of input line  
`end`  
&nbsp;&nbsp;&nbsp;&nbsp;go to end of input line  
`ctrl-n`  
&nbsp;&nbsp;&nbsp;&nbsp;go to next channel  
`ctrl-p`  
&nbsp;&nbsp;&nbsp;&nbsp;go to previous channel  
`ctrl-a`  
&nbsp;&nbsp;&nbsp;&nbsp;go to next unread channel  
`pageup`  
&nbsp;&nbsp;&nbsp;&nbsp;scroll up through backlog  
`pagedown`  
&nbsp;&nbsp;&nbsp;&nbsp;scroll down through backlog  
`shift-pageup`  
&nbsp;&nbsp;&nbsp;&nbsp;scroll up through nicklist  
`shift-pagedown`  
&nbsp;&nbsp;&nbsp;&nbsp;scroll down through nicklist  
`alt-[1,9]`   
&nbsp;&nbsp;&nbsp;&nbsp;select channels  1-9  
`alt-n`  
&nbsp;&nbsp;&nbsp;&nbsp;tab between the cabals & channels panes   
`alt-l`  
&nbsp;&nbsp;&nbsp;&nbsp;tab toggle id suffixes on/off  

#### Configuration

The message styling can be [slightly tweaked](https://github.com/cabal-club/cabal-cli/pull/151#issuecomment-602599840).  
Regarding the supported options, see [`.cabal.yml-example`](.cabal.yml-example)
