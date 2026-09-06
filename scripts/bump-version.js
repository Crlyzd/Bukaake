#!/usr/bin/env node
/**
 * Bukaake Single Source of Truth (SSOT) Version Synchronizer
 * Bumps version in package.json (SSOT), package-lock.json, and Cargo.toml.
 * All frontend HTML, JS, and Tauri configs dynamically inherit this version (< 70 lines).
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

const pkg = readJson(pkgPath);
const currentVer = pkg.version || '0.1.2';
const arg = (process.argv[2] || 'patch').toLowerCase().trim();

function getSupportedFormatCount() {
  const fileAssocPath = path.join(rootDir, 'src-tauri', 'src', 'file_assoc.rs');
  if (!fs.existsSync(fileAssocPath)) return 37;
  const content = fs.readFileSync(fileAssocPath, 'utf8');
  const match = content.match(/SUPPORTED_EXTENSIONS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\];/);
  if (!match) return 37;
  const exts = match[1].match(/"([^"]+)"/g);
  return exts ? exts.length : 37;
}

function syncFormatCounts(formatCount) {
  const readmePath = path.join(rootDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8');
    readme = readme.replace(/\b\d+\s+Format Registrations\b/g, `${formatCount} Format Registrations`);
    readme = readme.replace(/### 📷 \d+\+\s+Formats/g, `### 📷 ${formatCount}+ Formats`);
    readme = readme.replace(/across all \d+ image formats/g, `across all ${formatCount} image formats`);
    fs.writeFileSync(readmePath, readme, 'utf8');
  }

  const agentsPath = path.join(rootDir, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    let agents = fs.readFileSync(agentsPath, 'utf8');
    agents = agents.replace(/Registers \d+ graphic formats/g, `Registers ${formatCount} graphic formats`);
    agents = agents.replace(/\b\d+ Formats tag\b/g, `${formatCount} Formats tag`);
    fs.writeFileSync(agentsPath, agents, 'utf8');
  }
}

const formatCount = getSupportedFormatCount();
syncFormatCounts(formatCount);

if (arg === 'sync' || arg === 'check') {
  console.log(`\n  ========================================================`);
  console.log(`    [+] Bukaake SSOT Status Checked (Version v${currentVer})`);
  console.log(`  ========================================================`);
  console.log(`    Supported Formats (Rust SSOT): ${formatCount}`);
  console.log(`    Synchronized: README.md & AGENTS.md\n`);
  process.exit(0);
}

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
  console.error(`[-] Unknown bump type '${arg}'. Use 'patch', 'minor', 'major', 'sync', or a version string like '1.0.1'.`);
  process.exit(1);
}

// 1. Update package.json (Single Source of Truth)
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
if (fs.existsSync(cargoPath)) {
  let content = fs.readFileSync(cargoPath, 'utf8');
  content = content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVer}"`);
  fs.writeFileSync(cargoPath, content, 'utf8');
}

console.log(`\n  ========================================================`);
console.log(`    [+] Bukaake SSOT Version Bumped: v${currentVer} -> v${newVer}`);
console.log(`  ========================================================`);
console.log(`    Updated: package.json (Single Source of Truth)`);
console.log(`    Updated: package-lock.json`);
console.log(`    Updated: src-tauri/Cargo.toml`);
console.log(`    Synchronized: Format count (${formatCount}) across documentation`);
console.log(`    Note: All HTML, JS, and Tauri configs inherit dynamically!\n`);
