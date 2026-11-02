#!/usr/bin/env node
/**
 * Bank drift check.
 *
 * The question banks live in two places: the bundled copy the app imports, and
 * the reference copy under `ionic-requirements/`. This script fails the build
 * when they diverge, so the reference stays trustworthy and a bank update can
 * never land in one place only.
 *
 * It also recomputes each cert's content version from the bundled bank and
 * compares it with `content-versions.ts`, so refreshing the content without
 * bumping the published version is a build failure (CONT-30).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] ?? process.cwd());
const BUNDLED = join(ROOT, 'src/app/core/content/banks');
const REFERENCE = join(ROOT, 'ionic-requirements/cert-banks/banks');
const VERSIONS_FILE = join(ROOT, 'src/app/core/content/content-versions.ts');

function listJson(dir, base = dir) {
  if (!existsSync(dir)) {
    return [];
  }
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJson(full, base));
    } else if (entry.name.endsWith('.json')) {
      out.push(relative(base, full));
    }
  }
  return out.sort();
}

function hashOf(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const problems = [];

const bundledFiles = listJson(BUNDLED);
const referenceFiles = listJson(REFERENCE);

const bundledSet = new Set(bundledFiles);
const referenceSet = new Set(referenceFiles);

for (const file of referenceFiles) {
  if (!bundledSet.has(file)) {
    problems.push(`missing from the bundled copy: ${file}`);
  }
}
for (const file of bundledFiles) {
  if (!referenceSet.has(file)) {
    problems.push(`bundled copy has a file the reference does not: ${file}`);
  }
}

for (const file of bundledFiles) {
  if (!referenceSet.has(file)) {
    continue;
  }
  const bundledHash = hashOf(join(BUNDLED, file));
  const referenceHash = hashOf(join(REFERENCE, file));
  if (bundledHash !== referenceHash) {
    problems.push(`content differs from the reference: ${file}`);
  }
}

// Content versions must match the freshest lastVerified date in each bank.
const maxVerified = new Map();
for (const file of bundledFiles) {
  const cert = file.split('/')[0];
  const questions = JSON.parse(readFileSync(join(BUNDLED, file), 'utf8'));
  for (const question of questions) {
    const date = question.lastVerified;
    if (typeof date === 'string' && date > (maxVerified.get(cert) ?? '')) {
      maxVerified.set(cert, date);
    }
  }
}

const versionsSource = existsSync(VERSIONS_FILE)
  ? readFileSync(VERSIONS_FILE, 'utf8')
  : '';
const declared = new Map();
for (const match of versionsSource.matchAll(/'([a-z]{3}-c\d{2})':\s*'(\d{4}-\d{2}-\d{2})'/g)) {
  declared.set(match[1], match[2]);
}

for (const [cert, date] of maxVerified) {
  const declaredDate = declared.get(cert);
  if (!declaredDate) {
    problems.push(`${cert}: no content version declared`);
  } else if (declaredDate !== date) {
    problems.push(
      `${cert}: content version is ${declaredDate} but the bank's freshest lastVerified is ${date}`,
    );
  }
}

if (problems.length === 0) {
  console.log(
    `bank drift: clean (${bundledFiles.length} files, ${maxVerified.size} certs)`,
  );
  process.exit(0);
}

console.error(`bank drift: ${problems.length} problem(s)`);
for (const problem of problems) {
  console.error(`  ${problem}`);
}
process.exit(1);
