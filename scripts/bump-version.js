#!/usr/bin/env node
/**
 * Bukaake Atomic Version Synchronizer (ES Module)
 * Bumps version across package.json, package-lock.json, Cargo.toml,
 * tauri.conf.json, updater-service.js, settings modals, and HTML templates (< 130 lines)
 * Usage: node scripts/bump-version.js [patch|minor|major|<semver>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const lockPath = path.join(rootDir, 'package-lock.json');
const cargoPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const updaterServicePath = path.join(rootDir, 'src', 'services', 'updater-service.js');
const settingsModalPath = path.join(rootDir, 'src', 'components', 'settings-modal.js');
const settingsAppPath = path.join(rootDir, 'src', 'settings-app.js');
const indexPath = path.join(rootDir, 'index.html');
const settingsHtmlPath = path.join(rootDir, 'settings.html');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function updateFile(filePath, regex, replacement) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

const pkg = readJson(pkgPath);
const currentVer = pkg.version || '1.0.0';
const arg = (process.argv[2] || 'patch').toLowerCase().trim();

let [major, minor, patch] = currentVer.split('.').map((n) => parseInt(n, 10) || 0);
let newVer = '';

if (arg === 'patch') {
  newVer = `${major}.${minor}.${patch + 1}`;
} else if (arg === 'minor') {
  newVer = `${major}.${minor + 1}.0`;
} else if (arg === 'major') {
  newVer = `${major + 1}.0.0`;
} else if (/^\d+\.\d+\.\d+/.test(arg)) {
  newVer = arg;
} else {
  console.error(`[-] Unknown bump type '${arg}'. Use 'patch', 'minor', 'major', or a version string like '1.0.1'.`);
  process.exit(1);
}

// 1. Update package.json
pkg.version = newVer;
writeJson(pkgPath, pkg);

// 2. Update package-lock.json
if (fs.existsSync(lockPath)) {
  const lock = readJson(lockPath);
  lock.version = newVer;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVer;
  }
  writeJson(lockPath, lock);
}

// 3. Update src-tauri/Cargo.toml
updateFile(cargoPath, /^version\s*=\s*"[^"]+"/m, `version = "${newVer}"`);

// 4. Update src-tauri/tauri.conf.json
const tauriConf = readJson(tauriConfPath);
tauriConf.version = newVer;
writeJson(tauriConfPath, tauriConf);

// 5. Update src/services/updater-service.js
updateFile(updaterServicePath, /this\.currentVersion\s*=\s*['"][^'"]+['"]/g, `this.currentVersion = '${newVer}'`);
updateFile(updaterServicePath, /setUpdateAvailable\(hasUpdate,\s*version\s*=\s*['"][^'"]+['"]([^)]*)\)/g, `setUpdateAvailable(hasUpdate, version = '${newVer}'$1)`);

// 6. Update settings UI scripts
const statusRegex = /Bukaake v[0-9]+\.[0-9]+\.[0-9]+ \(Latest Version\)/g;
const fallbackRegex = /state\.version\s*\|\|\s*['"][0-9]+\.[0-9]+\.[0-9]+['"]/g;
updateFile(settingsModalPath, statusRegex, `Bukaake v${newVer} (Latest Version)`);
updateFile(settingsModalPath, fallbackRegex, `state.version || '${newVer}'`);
updateFile(settingsAppPath, statusRegex, `Bukaake v${newVer} (Latest Version)`);
updateFile(settingsAppPath, fallbackRegex, `state.version || '${newVer}'`);

// 7. Update HTML templates (titlebars, hero subtitles, status texts)
updateFile(indexPath, /class="app-version"([^>]*)>v[0-9]+\.[0-9]+\.[0-9]+</g, `class="app-version"$1>v${newVer}<`);
updateFile(indexPath, /class="settings-subtitle">v[0-9]+\.[0-9]+\.[0-9]+/g, `class="settings-subtitle">v${newVer}`);
updateFile(indexPath, /class="settings-hero-subtitle">v[0-9]+\.[0-9]+\.[0-9]+/g, `class="settings-hero-subtitle">v${newVer}`);
updateFile(indexPath, /id="updateStatusText">Bukaake v[0-9]+\.[0-9]+\.[0-9]+ \(Latest Version\)</g, `id="updateStatusText">Bukaake v${newVer} (Latest Version)<`);

updateFile(settingsHtmlPath, /class="settings-win-version"([^>]*)>v[0-9]+\.[0-9]+\.[0-9]+</g, `class="settings-win-version"$1>v${newVer}<`);
updateFile(settingsHtmlPath, /class="settings-hero-subtitle">v[0-9]+\.[0-9]+\.[0-9]+/g, `class="settings-hero-subtitle">v${newVer}`);
updateFile(settingsHtmlPath, /id="updateStatusText">Bukaake v[0-9]+\.[0-9]+\.[0-9]+ \(Latest Version\)</g, `id="updateStatusText">Bukaake v${newVer} (Latest Version)<`);

console.log(`\n  ========================================================`);
console.log(`    [+] Bukaake Version Bumped: v${currentVer} -> v${newVer}`);
console.log(`  ========================================================`);
console.log(`    Updated: package.json`);
console.log(`    Updated: package-lock.json`);
console.log(`    Updated: src-tauri/Cargo.toml`);
console.log(`    Updated: src-tauri/tauri.conf.json`);
console.log(`    Updated: src/services/updater-service.js`);
console.log(`    Updated: src/components/settings-modal.js`);
console.log(`    Updated: src/settings-app.js`);
console.log(`    Updated: index.html`);
console.log(`    Updated: settings.html\n`);

