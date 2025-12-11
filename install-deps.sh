#!/bin/bash
# Install system dependencies for canvas on Vercel
set -e

# Check if we're on a system that supports apt-get (Vercel uses Debian-based images)
if command -v apt-get &> /dev/null; then
  echo "Installing system dependencies for canvas..."
  apt-get update -qq
  apt-get install -y -qq \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    pkg-config
  echo "System dependencies installed successfully"
else
  echo "apt-get not available, skipping system dependency installation"
fi

