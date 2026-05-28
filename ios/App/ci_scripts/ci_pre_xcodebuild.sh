#!/bin/sh
set -e

cd "$CI_PRIMARY_REPOSITORY_PATH"

# Set these in App Store Connect → Xcode Cloud → your workflow → Environment:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
#   VITE_APP_URL  (optional; defaults to https://thedisccaddy.com)

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "error: Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the Xcode Cloud workflow environment."
  exit 1
fi

export VITE_APP_URL="${VITE_APP_URL:-https://thedisccaddy.com}"

echo "ci_pre_xcodebuild: vite build + cap sync ios"
npm run build
npx cap sync ios
