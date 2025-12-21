#!/bin/bash

# Load environment variables from .env
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

if [ -z "$OVSX_PAT" ]; then
  echo "Error: OVSX_PAT not found in .env"
  exit 1
fi

echo "📦 Packaging extension..."
npx vsce package

# Find the generated vsix file (latest version)
VSIX_FILE=$(ls synaptree-*.vsix | sort -V | tail -n 1)

if [ -z "$VSIX_FILE" ]; then
  echo "Error: VSIX file not found"
  exit 1
fi

echo "🚀 Publishing $VSIX_FILE to OpenVSX..."
npx ovsx publish "$VSIX_FILE" -p "$OVSX_PAT"

echo "✅ Done!"
