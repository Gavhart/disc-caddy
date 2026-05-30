#!/bin/sh
set -e

# Xcode Cloud's macOS runner has Homebrew preinstalled but NOT Node/npm.
# We need Node available before npm ci, otherwise Xcode can't resolve
# node_modules/@capacitor/* when it tries to build.
echo "ci_post_clone: install Node via Homebrew"
brew install node@20
brew link --overwrite --force node@20

# Sanity check — fail loudly if Node didn't land on PATH.
which node || { echo "node not on PATH after brew install"; exit 1; }
which npm  || { echo "npm not on PATH after brew install";  exit 1; }
node --version
npm --version

# Xcode Cloud clones the repo without node_modules. Install deps so that
# the SPM resolution step (which points at node_modules/@capacitor/*) succeeds.
echo "ci_post_clone: npm ci"
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci
