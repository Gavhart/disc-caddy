#!/bin/sh
set -e

# Xcode Cloud clones the repo without node_modules. Capacitor iOS (SPM) points at
# node_modules/@capacitor/* — install deps before Xcode resolves packages.
echo "ci_post_clone: npm ci"
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci
