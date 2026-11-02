import type { Certification } from './certification-types';
import { questionType, type Question, type RawQuestion } from './question-types';

/**
 * Domain loaders.
 *
 * Each cert and domain maps to a dynamic `import()`, so the bank is bundled into
 * the app as code-split chunks and never fetched at runtime (IONIC-12, CONT-26).
 * Adding a certification means adding its entry here as well as its JSON files
 * and registry entry (CERT-5, CONT-28).
 */

/**
 * JSON imports infer a literal union per file, so the loader is typed loosely
 * and the result is cast at this single boundary. The content gate in
 * `banks.spec.ts` is what actually guarantees the shape.
 */
type DomainLoader = () => Promise<{ default: readonly unknown[] }>;

const LOADERS: Readonly<Record<string, Readonly<Record<number, DomainLoader>>>> = {
  'clf-c02': {
    1: () => import('./banks/clf-c02/domain1.json'),
    2: () => import('./banks/clf-c02/domain2.json'),
    3: () => import('./banks/clf-c02/domain3.json'),
    4: () => import('./banks/clf-c02/domain4.json'),
  },
  'aif-c01': {
    1: () => import('./banks/aif-c01/domain1.json'),
    2: () => import('./banks/aif-c01/domain2.json'),
    3: () => import('./banks/aif-c01/domain3.json'),
    4: () => import('./banks/aif-c01/domain4.json'),
    5: () => import('./banks/aif-c01/domain5.json'),
  },
  'saa-c03': {
    1: () => import('./banks/saa-c03/domain1.json'),
    2: () => import('./banks/saa-c03/domain2.json'),
    3: () => import('./banks/saa-c03/domain3.json'),
    4: () => import('./banks/saa-c03/domain4.json'),
  },
};

/** Loaded domains, keyed by `${cert}:${domainId}`. */
const cache = new Map<string, readonly Question[]>();

function cacheKey(certCode: string, domainId: number): string {
  return `${certCode}:${domainId}`;
}

/**
 * Load one domain and stamp every question with its domain id, which the JSON
 * files do not store.
 *
 * The returned array is cached and shared, so callers must treat it as
 * read-only.
 */
export async function loadDomainQuestions(
  certCode: string,
  domainId: number,
): Promise<readonly Question[]> {
  const key = cacheKey(certCode, domainId);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const certLoaders = LOADERS[certCode];
  if (!certLoaders) {
    throw new Error(`No question bank is registered for cert "${certCode}"`);
  }

  const loader = certLoaders[domainId];
  if (!loader) {
    throw new Error(`Cert "${certCode}" declares no domain ${domainId}`);
  }

  const module = await loader();
  const raw = module.default as readonly RawQuestion[];
  const questions: Question[] = raw.map((question) => ({
    ...question,
    domainId,
    isMultiAnswer: question.isMultiAnswer ?? questionType(question) === 'multi',
  }));

  cache.set(key, questions);
  return questions;
}

/** Load every domain of a cert, in domain order. */
export async function loadAllQuestions(certCode: string): Promise<Question[]> {
  const certLoaders = LOADERS[certCode];
  if (!certLoaders) {
    throw new Error(`No question bank is registered for cert "${certCode}"`);
  }

  const domainIds = Object.keys(certLoaders)
    .map(Number)
    .sort((a, b) => a - b);

  const domains = await Promise.all(
    domainIds.map((domainId) => loadDomainQuestions(certCode, domainId)),
  );

  return domains.flatMap((questions) => [...questions]);
}

/** Drop the in-memory cache. Used by tests and by a content reload. */
export function clearQuestionCache(): void {
  cache.clear();
}

/**
 * Check that every registry domain has a loader and that no loader points at a
 * domain the registry does not declare. Returns human readable problems.
 */
export function validateLoaderCoverage(
  registry: Readonly<Record<string, Certification>>,
): string[] {
  const problems: string[] = [];

  for (const [code, cert] of Object.entries(registry)) {
    const loaders = LOADERS[code];
    if (!loaders) {
      problems.push(`${code}: registry entry has no loader map`);
      continue;
    }
    const loaderDomains = Object.keys(loaders).map(Number);
    const registryDomains = cert.domains.map((domain) => domain.id);

    for (const domainId of registryDomains) {
      if (!loaderDomains.includes(domainId)) {
        problems.push(`${code}: domain ${domainId} is declared but has no loader`);
      }
    }
    for (const domainId of loaderDomains) {
      if (!registryDomains.includes(domainId)) {
        problems.push(`${code}: loader for domain ${domainId} is not in the registry`);
      }
    }
  }

  for (const code of Object.keys(LOADERS)) {
    if (!Object.prototype.hasOwnProperty.call(registry, code)) {
      problems.push(`${code}: loader map exists but the registry does not declare it`);
    }
  }

  return problems;
}
