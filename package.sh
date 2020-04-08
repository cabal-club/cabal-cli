#!/usr/bin/env sh
# couldnt figure out undocumented 'output template' mode for pkg so wrote this
# also need to include .node files until pkg supports including them in binary
#   https://github.com/zeit/pkg/issues/329

NODE_ABI="node.napi"
VERSION=$(node -pe "require('./package.json').version")

rm -rf dist

mkdir dist
mkdir builds/cabal-$VERSION-linux-x64
mkdir builds/cabal-$VERSION-macos-x64
mkdir builds/cabal-$VERSION-win-x64

mv builds/cabal-linux builds/cabal-$VERSION-linux-x64/cabal
mv builds/cabal-macos builds/cabal-$VERSION-macos-x64/cabal
mv builds/cabal-win.exe builds/cabal-$VERSION-win-x64/cabal.exe

cp node_modules/utp-native/prebuilds/linux-x64/$NODE_ABI.node builds/cabal-$VERSION-linux-x64/
cp node_modules/utp-native/prebuilds/darwin-x64/$NODE_ABI.node builds/cabal-$VERSION-macos-x64/
cp node_modules/utp-native/prebuilds/win32-x64/$NODE_ABI.node builds/cabal-$VERSION-win-x64/

cp node_modules/leveldown/prebuilds/linux-x64/$NODE_ABI.node builds/cabal-$VERSION-linux-x64/
cp node_modules/leveldown/prebuilds/darwin-x64/$NODE_ABI.node builds/cabal-$VERSION-macos-x64/
cp node_modules/leveldown/prebuilds/win32-x64/$NODE_ABI.node builds/cabal-$VERSION-win-x64/

cp LICENSE builds/cabal-$VERSION-linux-x64/
cp LICENSE builds/cabal-$VERSION-macos-x64/
cp LICENSE builds/cabal-$VERSION-win-x64/

cp README.md builds/cabal-$VERSION-linux-x64/README
cp README.md builds/cabal-$VERSION-macos-x64/README
cp README.md builds/cabal-$VERSION-win-x64/README

cd builds
../node_modules/.bin/cross-zip cabal-$VERSION-linux-x64 ../dist/cabal-$VERSION-linux-x64.zip
../node_modules/.bin/cross-zip cabal-$VERSION-macos-x64 ../dist/cabal-$VERSION-macos-x64.zip
../node_modules/.bin/cross-zip cabal-$VERSION-win-x64 ../dist/cabal-$VERSION-win-x64.zip

rm -rf builds

# now travis will upload the 3 zips in dist to the release