/**
 * Bukaake i18n Tool: Bi-directional JSON <-> TXT Converter (< 160 lines)
 * 
 * Usage:
 *   node scripts/i18n-tool.js export <json-file> <txt-file> [reference-en-json]
 *   node scripts/i18n-tool.js import <txt-file> <json-file>
 */

import fs from 'fs';
import path from 'path';

function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flatten(val, fullKey));
    } else {
      result[fullKey] = String(val);
    }
  }
  return result;
}

function unflatten(flat) {
  const result = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    const parts = flatKey.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

function exportToTxt(jsonPath, txtPath, refEnPath) {
  const targetJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const flatTarget = flatten(targetJson);
  const flatRef = refEnPath && fs.existsSync(refEnPath)
    ? flatten(JSON.parse(fs.readFileSync(refEnPath, 'utf8')))
    : {};

  const lines = [
    '# ====================================================================',
    '# Bukaake Translation File (Easily Editable)',
    '# ',
    '# INSTRUCTIONS:',
    '# 1. Edit the translation text on the right side of the "=" sign.',
    '# 2. Do not change the key names on the left side of the "=" sign.',
    '# 3. Keep placeholders like {hotkey} or {lang} intact.',
    '# 4. Lines starting with "#" are comments or English references.',
    '# ====================================================================',
    ''
  ];

  let currentSection = '';

  for (const [key, value] of Object.entries(flatTarget)) {
    const section = key.split('.')[0];
    if (section !== currentSection) {
      currentSection = section;
      lines.push('', `# --- Section: ${section} ---`);
    }

    if (flatRef[key]) {
      lines.push(`# EN: ${flatRef[key]}`);
    }
    lines.push(`${key} = ${value}`);
  }

  fs.writeFileSync(txtPath, lines.join('\n'), 'utf8');
  console.log(`[i18n-tool] Successfully exported to ${txtPath}`);
}

function importFromTxt(txtPath, jsonPath) {
  const content = fs.readFileSync(txtPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const flat = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) {
      flat[key] = value;
    }
  }

  const nested = unflatten(flat);
  fs.writeFileSync(jsonPath, JSON.stringify(nested, null, 2) + '\n', 'utf8');
  console.log(`[i18n-tool] Successfully compiled ${txtPath} -> ${jsonPath}`);
}

// CLI handler
const [,, command, srcArg, destArg, refArg] = process.argv;

if (command === 'export' && srcArg && destArg) {
  exportToTxt(path.resolve(srcArg), path.resolve(destArg), refArg ? path.resolve(refArg) : null);
} else if (command === 'import' && srcArg && destArg) {
  importFromTxt(path.resolve(srcArg), path.resolve(destArg));
} else {
  console.log('Usage:');
  console.log('  node scripts/i18n-tool.js export <input.json> <output.txt> [reference-en.json]');
  console.log('  node scripts/i18n-tool.js import <input.txt> <output.json>');
}

