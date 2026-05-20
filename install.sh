#!/bin/bash
set -e

echo "========================================="
echo " Ghost Writer - Automated Setup Script   "
echo "========================================="

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "[ERROR] Node.js is required. Please install Node.js (v20+)."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "[ERROR] Git is required. Please install Git."
    exit 1
fi

INSTALL_DIR="$HOME/Desktop/Ghost_Writer"

if [ -d "$INSTALL_DIR" ]; then
    echo "Directory already exists at $INSTALL_DIR."
    echo "Pulling latest changes..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo "Cloning Ghost Writer to $INSTALL_DIR..."
    git clone https://github.com/lazylabsai/Ghost_Writer.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo "Installing Node.js dependencies..."
npm install

echo "Building Ghost Writer..."
npm run build:desktop

echo "========================================="
echo " Ghost Writer has been successfully setup! "
echo " To start the app, run the following commands:"
echo "   cd ~/Desktop/Ghost_Writer"
echo "   npm start"
echo "========================================="
