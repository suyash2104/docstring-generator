#!/usr/bin/env bash
set -e

# Version of node-llama-cpp you want
VERSION="3.12.1"

# Platforms to fetch (npm package names)
PLATFORMS=(
  "linux-x64"
  "linux-arm64"
  "win-x64"
  "win-arm64"
  "darwin-x64"
  "darwin-arm64"
)

# Destination directory inside your extension
DEST_DIR="binaries"

mkdir -p "$DEST_DIR"

echo "Fetching node-llama-cpp binaries (version $VERSION)..."

for PLATFORM in "${PLATFORMS[@]}"; do
    PKG="@node-llama-cpp/$PLATFORM"
    echo "Downloading $PKG..."

    # Get tarball URL from npm
    URL=$(npm view "$PKG@$VERSION" dist.tarball)

    if [ -z "$URL" ]; then
        echo "❌ Failed to find $PKG@$VERSION on npm."
        exit 1
    fi

    # Download and extract llama.node only
    TMP_DIR=$(mktemp -d)
    wget -qO "$TMP_DIR/package.tgz" "$URL"
    tar -xzf "$TMP_DIR/package.tgz" -C "$TMP_DIR"
    ls "$TMP_DIR/package/bins/"

    NODE_PATH=$(find "$TMP_DIR/package" -type f -name "llama.node" | head -n 1)
    if [ ! -f "$NODE_PATH" ]; then
        echo "❌ llama.node not found for $PLATFORM."
        exit 1
    fi

    # Place into binaries/<platform>/
    PLATFORM_DIR="$DEST_DIR/$PLATFORM"
    mkdir -p "$PLATFORM_DIR"
    cp "$NODE_PATH" "$PLATFORM_DIR/llama.node"

    echo "✅ $PLATFORM binary saved to $PLATFORM_DIR/llama.node"
    rm -rf "$TMP_DIR"
done

echo "All binaries fetched successfully into '$DEST_DIR/'"