$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Ghost Writer - Automated Setup Script    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Verify Node and Git
try {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is required but not installed. Please install Node.js (v20+) from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

try {
    npm -v | Out-Null
} catch {
    Write-Host "[ERROR] npm is required but not found." -ForegroundColor Red
    exit 1
}

try {
    git --version | Out-Null
} catch {
    Write-Host "[ERROR] Git is required but not installed. Please install Git from https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# 2. Install into user home directory (not Desktop)
$InstallDir = Join-Path $env:USERPROFILE "Ghost_Writer"

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

# 3. Install dependencies
Write-Host "Installing Node.js dependencies (this may take a few minutes)..." -ForegroundColor Cyan
npm install

# 4. Rebuild native modules against Electron's Node.js headers
#    This fixes the NODE_MODULE_VERSION mismatch between system Node.js and Electron.
Write-Host "Rebuilding native modules for Electron..." -ForegroundColor Cyan
try {
    # Get the Electron version from the installed package
    $electronVersion = node -e "console.log(require('./node_modules/electron/package.json').version)"
    Write-Host "  Electron version: $electronVersion" -ForegroundColor Gray

    # Use @electron/rebuild to compile better-sqlite3 against Electron's headers
    npx --yes @electron/rebuild -v $electronVersion -m . --only better-sqlite3
    Write-Host "[OK] Native modules rebuilt successfully" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Native module rebuild failed. Trying alternative method..." -ForegroundColor Yellow
    try {
        # Fallback: manual rebuild using electron headers
        $electronVersion = node -e "console.log(require('./node_modules/electron/package.json').version)"
        npm rebuild better-sqlite3 --build-from-source --runtime=electron --target=$electronVersion --disturl=https://electronjs.org/headers
        Write-Host "[OK] Native modules rebuilt (fallback method)" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to rebuild native modules. The app may not work correctly." -ForegroundColor Red
        Write-Host "  Try running manually: npx @electron/rebuild" -ForegroundColor Yellow
    }
}

# 5. Build the application
Write-Host "Building Ghost Writer..." -ForegroundColor Cyan
npm run build:desktop

# 6. Create Desktop Shortcut
Write-Host "Creating desktop shortcut..." -ForegroundColor Cyan
try {
    $DesktopPath = [System.Environment]::GetFolderPath("Desktop")
    $ShortcutPath = Join-Path $DesktopPath "Ghost Writer.lnk"
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "cmd.exe"
    $Shortcut.Arguments = "/c cd /d `"$InstallDir`" && npm start"
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Ghost Writer - AI Interview & Meeting Copilot"
    $Shortcut.WindowStyle = 7  # Minimized (hides the cmd window)

    # Use the app icon if available
    $IconPath = Join-Path $InstallDir "assets\icons\win\icon.ico"
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = $IconPath
    }

    $Shortcut.Save()
    Write-Host "[OK] Desktop shortcut created" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not create desktop shortcut. You can start the app manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " Ghost Writer has been successfully setup! " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host " You can start the app by:" -ForegroundColor White
Write-Host "   1. Double-click the 'Ghost Writer' shortcut on your Desktop" -ForegroundColor White
Write-Host "   2. Or run these commands:" -ForegroundColor White
Write-Host "      cd $InstallDir" -ForegroundColor Yellow
Write-Host "      npm start" -ForegroundColor Yellow
Write-Host ""
