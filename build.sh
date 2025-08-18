#!/bin/bash
set -e

npm run dev
rm -rf dist*
mkdir dist
cp -r manifest.json icon*.png {content,popup}.js popup.html dist

# for FF AMO
pushd dist
zip -r dist.zip -- *
popd
git clone --depth=1 --branch=master file://"$PWD" dist_src
rm -rf ./dist_src/{.git,icon*,LICENSE}
cd dist_src
zip -r dist_src.zip -- *