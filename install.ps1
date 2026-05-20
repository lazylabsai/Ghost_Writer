$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Ghost Writer - Automated Setup Script   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Verify Node and Git
try {
    node -v | Out-Null
    npm -v | Out-Null
} catch {
    Write-Host "[ERROR] Node.js is required but not installed. Please install Node.js (v20+) from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

try {
    git --version | Out-Null
} catch {
    Write-Host "[ERROR] Git is required but not installed. Please install Git from https://git-scm.com/" -ForegroundColor Red
    exit 1
}

$InstallDir = Join-Path $env:USERPROFILE "Desktop\Ghost_Writer"

if (Test-Path $InstallDir) {
    Write-Host "Directory already exists at $InstallDir." -ForegroundColor Yellow
    Write-Host "Pulling latest changes..." -ForegroundColor Cyan
    Set-Location $InstallDir
    git pull origin main
} else {
    Write-Host "Cloning Ghost Writer to $InstallDir..." -ForegroundColor Cyan
    git clone https://github.com/lazylabsai/Ghost_Writer.git $InstallDir
    Set-Location $InstallDir
}

Write-Host "Installing Node.js dependencies (this may take a few minutes)..." -ForegroundColor Cyan
npm install

Write-Host "Building Ghost Writer..." -ForegroundColor Cyan
npm run build:desktop

Write-Host "=========================================" -ForegroundColor Green
Write-Host " Ghost Writer has been successfully setup! " -ForegroundColor Green
Write-Host " To start the app, run the following commands:" -ForegroundColor Green
Write-Host "   cd ~/Desktop/Ghost_Writer" -ForegroundColor Green
Write-Host "   npm start" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
