$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    Ghost Writer - One-Click Installer     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check prerequisites ──────────────────────────────────────────────
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor White

$missingDeps = @()

try { node -v | Out-Null } catch { $missingDeps += "Node.js (v20+) — https://nodejs.org" }
try { npm -v | Out-Null } catch { $missingDeps += "npm — comes with Node.js" }
try { git --version | Out-Null } catch { $missingDeps += "Git — https://git-scm.com" }

if ($missingDeps.Count -gt 0) {
    Write-Host ""
    Write-Host "  Missing required software:" -ForegroundColor Red
    foreach ($dep in $missingDeps) {
        Write-Host "    - $dep" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Please install the above and re-run this installer." -ForegroundColor Red
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}

$nodeVer = (node -v).Trim()
Write-Host "  Node.js $nodeVer" -ForegroundColor Green
Write-Host "  Git installed" -ForegroundColor Green

# ── Step 2: Set up install directory ─────────────────────────────────────────
Write-Host ""
Write-Host "[2/6] Setting up Ghost Writer..." -ForegroundColor White

$InstallDir = Join-Path $env:USERPROFILE "Ghost_Writer"

# Clean up old Desktop install if it exists (from previous installer version)
$OldDesktopInstall = Join-Path $env:USERPROFILE "Desktop\Ghost_Writer"
if ((Test-Path $OldDesktopInstall) -and ($OldDesktopInstall -ne $InstallDir)) {
    Write-Host "  Cleaning up old install from Desktop..." -ForegroundColor Yellow
    try { Remove-Item $OldDesktopInstall -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}

if (Test-Path $InstallDir) {
    Write-Host "  Updating existing installation..." -ForegroundColor Cyan
    Set-Location $InstallDir
    git pull origin main 2>&1 | Out-Null
    Write-Host "  Updated to latest version" -ForegroundColor Green
} else {
    Write-Host "  Downloading Ghost Writer..." -ForegroundColor Cyan
    git clone --depth 1 https://github.com/lazylabsai/Ghost_Writer.git $InstallDir 2>&1 | Out-Null
    Set-Location $InstallDir
    Write-Host "  Download complete" -ForegroundColor Green
}

# ── Step 3: Install dependencies ─────────────────────────────────────────────
Write-Host ""
Write-Host "[3/6] Installing dependencies (this may take 2-3 minutes)..." -ForegroundColor White

npm install --loglevel=error 2>&1 | Out-Null
Write-Host "  Dependencies installed" -ForegroundColor Green

# ── Step 4: Rebuild native modules for Electron ─────────────────────────────
Write-Host ""
Write-Host "[4/6] Configuring native modules..." -ForegroundColor White

try {
    $electronVersion = node -e "console.log(require('./node_modules/electron/package.json').version)"
    npx --yes @electron/rebuild -v $electronVersion -m . --only better-sqlite3 2>&1 | Out-Null
    Write-Host "  Native modules configured" -ForegroundColor Green
} catch {
    Write-Host "  Native module rebuild had warnings (app may still work)" -ForegroundColor Yellow
}

# ── Step 5: Build the application ────────────────────────────────────────────
Write-Host ""
Write-Host "[5/6] Building application..." -ForegroundColor White

npm run build:desktop 2>&1 | Out-Null
Write-Host "  Build complete" -ForegroundColor Green

# ── Step 6: Create Desktop Shortcut & Start Menu Entry ───────────────────────
Write-Host ""
Write-Host "[6/6] Creating shortcuts..." -ForegroundColor White

# Create a launcher batch script (hidden) that starts the app cleanly
$LauncherScript = Join-Path $InstallDir "launch.vbs"
$LauncherContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$InstallDir"
WshShell.Run "cmd /c npm start", 0, False
"@
Set-Content -Path $LauncherScript -Value $LauncherContent -Force

# Desktop Shortcut
try {
    $DesktopPath = [System.Environment]::GetFolderPath("Desktop")
    $ShortcutPath = Join-Path $DesktopPath "Ghost Writer.lnk"
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = "`"$LauncherScript`""
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Ghost Writer - AI Interview & Meeting Copilot"
    $Shortcut.WindowStyle = 1

    $IconPath = Join-Path $InstallDir "assets\icons\win\icon.ico"
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = $IconPath
    }

    $Shortcut.Save()
    Write-Host "  Desktop shortcut created" -ForegroundColor Green
} catch {
    Write-Host "  Could not create desktop shortcut" -ForegroundColor Yellow
}

# Start Menu Shortcut
try {
    $StartMenuPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
    $StartShortcutPath = Join-Path $StartMenuPath "Ghost Writer.lnk"
    $WshShell2 = New-Object -ComObject WScript.Shell
    $StartShortcut = $WshShell2.CreateShortcut($StartShortcutPath)
    $StartShortcut.TargetPath = "wscript.exe"
    $StartShortcut.Arguments = "`"$LauncherScript`""
    $StartShortcut.WorkingDirectory = $InstallDir
    $StartShortcut.Description = "Ghost Writer - AI Interview & Meeting Copilot"

    $IconPath = Join-Path $InstallDir "assets\icons\win\icon.ico"
    if (Test-Path $IconPath) {
        $StartShortcut.IconLocation = $IconPath
    }

    $StartShortcut.Save()
    Write-Host "  Start Menu shortcut created" -ForegroundColor Green
} catch {
    Write-Host "  Could not create Start Menu shortcut" -ForegroundColor Yellow
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "     Ghost Writer installed successfully!  " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Launching Ghost Writer now..." -ForegroundColor Cyan
Write-Host ""

# Auto-launch the app
Start-Process "wscript.exe" -ArgumentList "`"$LauncherScript`""
