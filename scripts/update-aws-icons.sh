#!/bin/bash
# Script to download and update AWS Architecture Icons
# This fetches the latest AWS Asset Package and extracts the Architecture-Service-Icons

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_ROOT/apps/logo-quiz/public/assets"
TEMP_DIR="/tmp/aws-icons-update"

echo "==> Fetching latest AWS Asset Package URL..."

# Fetch the AWS Architecture Icons page and extract the Asset Package URL
ASSET_URL=$(curl -sL "https://aws.amazon.com/architecture/icons/" | grep -oE 'https://[^"]+Asset-Package[^"]+\.zip' | head -1)

if [ -z "$ASSET_URL" ]; then
    echo "ERROR: Could not find Asset Package URL on AWS page"
    exit 1
fi

echo "==> Found Asset Package URL: $ASSET_URL"

# Create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "==> Downloading Asset Package..."
curl -sL "$ASSET_URL" -o aws-icons.zip

echo "==> Extracting Architecture-Service-Icons..."
# Extract only the Architecture-Service-Icons folder (excluding __MACOSX)
unzip -q aws-icons.zip 'Architecture-Service-Icons_*/*' -x '__MACOSX/*'

# Find the extracted folder (it has a date suffix like Architecture-Service-Icons_07312025)
EXTRACTED_DIR=$(ls -d Architecture-Service-Icons_* 2>/dev/null | head -1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "ERROR: Could not find extracted Architecture-Service-Icons folder"
    exit 1
fi

echo "==> Found extracted folder: $EXTRACTED_DIR"

# Backup existing icons if they exist
if [ -d "$ASSETS_DIR/Architecture-Service-Icons" ]; then
    echo "==> Backing up existing icons..."
    rm -rf "$ASSETS_DIR/Architecture-Service-Icons.bak"
    mv "$ASSETS_DIR/Architecture-Service-Icons" "$ASSETS_DIR/Architecture-Service-Icons.bak"
fi

# Move new icons to assets directory
echo "==> Installing new icons to $ASSETS_DIR/Architecture-Service-Icons..."
mv "$EXTRACTED_DIR" "$ASSETS_DIR/Architecture-Service-Icons"

# Clean up
echo "==> Cleaning up..."
rm -rf "$TEMP_DIR"

# Remove backup if everything succeeded
if [ -d "$ASSETS_DIR/Architecture-Service-Icons.bak" ]; then
    rm -rf "$ASSETS_DIR/Architecture-Service-Icons.bak"
fi

# Count icons
ICON_COUNT=$(find "$ASSETS_DIR/Architecture-Service-Icons" -name "*.png" | wc -l | tr -d ' ')
echo "==> Done! Installed $ICON_COUNT PNG icons"

# Extract version from URL (date portion)
VERSION=$(echo "$ASSET_URL" | grep -oE 'Asset-Package_[0-9]+' | sed 's/Asset-Package_//')
echo "==> Asset Package version: $VERSION"
