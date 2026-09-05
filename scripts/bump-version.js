#!/usr/bin/env node
/**
 * Bukaake Atomic Version Synchronizer (ES Module)
 * Bumps version across package.json, Cargo.toml, and tauri.conf.json
 * Usage: node scripts/bump-version.js [patch|minor|major|<semver>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const cargoPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
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

// 2. Update src-tauri/Cargo.toml
let cargoContent = fs.readFileSync(cargoPath, 'utf8');
cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVer}"`);
fs.writeFileSync(cargoPath, cargoContent, 'utf8');

// 3. Update src-tauri/tauri.conf.json
const tauriConf = readJson(tauriConfPath);
tauriConf.version = newVer;
writeJson(tauriConfPath, tauriConf);

console.log(`\n  ========================================================`);
console.log(`    [+] Bukaake Version Bumped: v${currentVer} -> v${newVer}`);
console.log(`  ========================================================`);
console.log(`    Updated: package.json`);
console.log(`    Updated: src-tauri/Cargo.toml`);
console.log(`    Updated: src-tauri/tauri.conf.json\n`);
