#!/bin/bash

# SPDX-FileCopyrightText: 2023 the cabal-club authors
#
# SPDX-License-Identifier: CC0-1.0

# publish the mirrored `cabal-cli` repo
sed -i 's/"cabal"/"cabal-cli"/g' package.json  
npm publish
sed -i 's/"cabal-cli"/"cabal"/g' package.json  
