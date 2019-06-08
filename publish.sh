#!/bin/bash

npm publish
sed -i 's/"cabal"/"cabal-cli"/g' package.json  
npm publish
sed -i 's/"cabal-cli"/"cabal"/g' package.json  
