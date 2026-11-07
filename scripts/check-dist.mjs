#!/usr/bin/env node
/*
 * Production bundle checks (CONT-34 to CONT-41, CONT-38).
 *
 * Runs after `ng build --configuration production` and fails the gate on:
 * - missing bundled question content,
 * - any secret or backend key marker,
 * - web-only deploy leftovers,
 * - the development seed screen shipping to production.
 *
 * The checks are mechanical so review does not have to be trusted.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'dist', 'cloudcertprep');
const TEXT_EXTENSIONS = new Set(['.js', '.html', '.json', '.css', '.txt', '.mjs']);

const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

let files;
try {
  files = walk(ROOT);
} catch {
  console.error(`FAIL: build output not found at ${ROOT}. Run the production build first.`);
  process.exit(1);
}

const textFiles = files.filter((file) => {
  const dot = file.lastIndexOf('.');
  return dot !== -1 && TEXT_EXTENSIONS.has(file.slice(dot));
});

const contents = textFiles.map((file) => ({
  file: relative(ROOT, file),
  text: readFileSync(file, 'utf8'),
}));

if (!files.some((file) => file.endsWith(join('browser', 'index.html')) || file.endsWith('index.html'))) {
  fail('index.html is missing from the build output');
}

const allText = contents.map((entry) => entry.text).join('\n');

const BANK_MARKERS = [
  'Which of the following options are related to the reliability of AWS?',
  'Amazon Web Services',
  'domainId',
];

if (!BANK_MARKERS.some((marker) => allText.includes(marker))) {
  fail('bundled question bank content was not found in the build output');
}

const SECRET_PATTERNS = [
  /service_role/i,
  /supabase/i,
  /anon[_-]?key/i,
  /BEGIN (RSA |EC )?PRIVATE KEY/,
  /api[_-]?key["']?\s*[:=]\s*["'][^"']{8,}/i,
  /secret[_-]?key["']?\s*[:=]\s*["'][^"']{8,}/i,
];

for (const pattern of SECRET_PATTERNS) {
  const hit = contents.find((entry) => pattern.test(entry.text));
  if (hit) {
    fail(`secret or backend marker ${pattern} found in ${hit.file}`);
  }
}

const FORBIDDEN_FILES = [
  /(^|[\\/])_headers$/,
  /_routes\.json$/,
  /(^|[\\/])sitemap[^\\/]*$/i,
  /(^|[\\/])robots\.txt$/i,
  /netlify\.toml$/i,
  /vercel\.json$/i,
  /firebase\.json$/i,
  /\.htaccess$/,
];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (FORBIDDEN_FILES.some((pattern) => pattern.test(rel))) {
    fail(`web-only file should not ship: ${rel}`);
  }
}

if (allText.includes('__dev/seed') || allText.includes('Development seed')) {
  fail('development seed screen code is present in the production bundle');
}

if (failures.length > 0) {
  console.error('Production bundle checks FAILED:');
  for (const message of failures) {
    console.error(` - ${message}`);
  }
  process.exit(1);
}

console.log(
  `Production bundle checks passed (${files.length} files, ${textFiles.length} text assets scanned).`,
);
