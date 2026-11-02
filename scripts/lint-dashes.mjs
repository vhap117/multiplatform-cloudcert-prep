#!/usr/bin/env node
/**
 * Fails when content uses an em dash or en dash.
 *
 * IONIC-14 and CONT-13 forbid both characters in code, content, docs, and UI
 * copy. The rule is mechanical, so it is enforced mechanically instead of by
 * review.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] ?? process.cwd());
const SCAN_DIRS = ['src', 'issues', 'ionic-requirements'];
const SCAN_EXTENSIONS = new Set([
  '.ts', '.html', '.css', '.scss', '.json', '.md', '.mjs', '.js',
]);
const SKIP_DIRS = new Set(['node_modules', '.git', '.angular', 'dist', 'www', 'coverage']);

const FORBIDDEN = [
  { label: 'em dash (U+2014)', pattern: /\u2014/g },
  { label: 'en dash (U+2013)', pattern: /\u2013/g },
  { label: 'em dash entity', pattern: /&mdash;/gi },
  { label: 'en dash entity', pattern: /&ndash;/gi },
];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(extname(entry.name))) {
      yield full;
    }
  }
}

function extname(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot);
}

const violations = [];

for (const dir of SCAN_DIRS) {
  const absolute = join(ROOT, dir);
  try {
    if (!statSync(absolute).isDirectory()) {
      continue;
    }
  } catch {
    continue;
  }
  for (const file of walk(absolute)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const { label, pattern } of FORBIDDEN) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push({
            file: relative(ROOT, file),
            line: index + 1,
            label,
            text: line.trim().slice(0, 100),
          });
        }
      }
    });
  }
}

if (violations.length === 0) {
  console.log('dash lint: clean');
  process.exit(0);
}

console.error(`dash lint: ${violations.length} forbidden dash(es) found`);
for (const violation of violations) {
  console.error(`  ${violation.file}:${violation.line}  ${violation.label}`);
  console.error(`    ${violation.text}`);
}
process.exit(1);
