const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[postinstall] Running postinstall scripts...');

// 1. Rebuild sharp
try {
  console.log('[postinstall] Rebuilding sharp...');
  execSync('cross-env SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm rebuild sharp', { stdio: 'inherit' });
} catch (err) {
  console.warn('[postinstall] Warning: sharp rebuild failed:', err.message);
}

// Check if we should skip Electron rebuild
const isCI = process.env.CI === 'true';
const isLinux = process.platform === 'linux';

if (isCI && isLinux) {
  console.log('[postinstall] Running in CI on Linux. Skipping Electron native module rebuild.');
} else {
  // 2. Rebuild better-sqlite3 for Electron
  try {
    console.log('[postinstall] Checking Electron version...');
    const electronPkgPath = path.resolve(__dirname, '..', 'node_modules', 'electron', 'package.json');
    if (fs.existsSync(electronPkgPath)) {
      const electronVersion = require(electronPkgPath).version;
      console.log(`[postinstall] Rebuilding better-sqlite3 for Electron v${electronVersion}...`);
      execSync(`npx electron-rebuild -v ${electronVersion} -m . --only better-sqlite3`, { stdio: 'inherit' });
      console.log('[postinstall] Native modules rebuilt successfully.');
    } else {
      console.log('[postinstall] Electron not found in node_modules, skipping rebuild.');
    }
  } catch (err) {
    console.error('[postinstall] Error rebuilding native modules:', err.message);
    // Exit with code 1 if we're in CI (since CI tests require it), otherwise just log the warning
    if (isCI) {
      process.exit(1);
    }
  }
}
