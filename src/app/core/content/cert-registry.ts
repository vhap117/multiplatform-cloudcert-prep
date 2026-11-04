import type { Certification, CertStatus } from './certification-types';

export type {
  CertDomain,
  CertLevel,
  CertProvider,
  CertStatus,
  Certification,
  TaskStatement,
} from './certification-types';

/**
 * The bundled certification registry.
 *
 * This is the single source of truth for exam logistics: question count, time
 * limit, passing percentage, domains, domain proportions, and availability
 * (CERT-1, CONT-25). Scores, dashboards, and history read from here and never
 * hardcode a number.
 *
 * Values are transcribed from the web app's registry
 * (`ionic-requirements/cert-banks/reference/certifications.ts`) and verified by
 * `cert-registry.spec.ts`, which checks that proportions sum to exactly 1 and
 * that each domain's `questionCount` matches the bundled bank file.
 *
 * Adding a certification takes three changes: an entry here, the domain JSON
 * files under `banks/<code>/`, and a loader entry in `question-loader.ts`
 * (CERT-5, CONT-28).
 */
export const CERTIFICATIONS: Readonly<Record<string, Certification>> = {

  'clf-c02': {
    code: 'clf-c02',
    provider: 'aws',
    level: 'foundational',
    name: 'AWS Cloud Practitioner',
    shortName: 'CLF-C02',
    examQuestionCount: 65,
    examTimeSeconds: 5400,
    passingPercent: 67,
    status: 'active',
    examGuideVersion: 'CLF-C02',
    examGuideUrl: 'https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html',
    domains: [
      { id: 1, name: 'Cloud Concepts', questionCount: 187, examProportion: 0.24 },
      { id: 2, name: 'Security & Compliance', questionCount: 247, examProportion: 0.3 },
      { id: 3, name: 'Cloud Technology & Services', questionCount: 384, examProportion: 0.34 },
      { id: 4, name: 'Billing, Pricing & Support', questionCount: 232, examProportion: 0.12 },
    ],
    taskStatements: [
      { id: '1.1', domainId: 1, name: 'Define the benefits of the AWS Cloud' },
      { id: '1.2', domainId: 1, name: 'Identify design principles of the AWS Cloud' },
      { id: '1.3', domainId: 1, name: 'Understand the benefits of and strategies for migration to the AWS Cloud' },
      { id: '1.4', domainId: 1, name: 'Understand concepts of cloud economics' },
      { id: '2.1', domainId: 2, name: 'Understand the AWS shared responsibility model' },
      { id: '2.2', domainId: 2, name: 'Understand AWS Cloud security, governance, and compliance concepts' },
      { id: '2.3', domainId: 2, name: 'Identify AWS access management capabilities' },
      { id: '2.4', domainId: 2, name: 'Identify components and resources for security' },
      { id: '3.1', domainId: 3, name: 'Define methods of deploying and operating in the AWS Cloud' },
      { id: '3.2', domainId: 3, name: 'Define the AWS global infrastructure' },
      { id: '3.3', domainId: 3, name: 'Identify AWS compute services' },
      { id: '3.4', domainId: 3, name: 'Identify AWS database services' },
      { id: '3.5', domainId: 3, name: 'Identify AWS network services' },
      { id: '3.6', domainId: 3, name: 'Identify AWS storage services' },
      { id: '3.7', domainId: 3, name: 'Identify AWS artificial intelligence and machine learning (AI/ML) services and analytics services' },
      { id: '3.8', domainId: 3, name: 'Identify services from other in-scope AWS service categories' },
      { id: '4.1', domainId: 4, name: 'Compare AWS pricing models' },
      { id: '4.2', domainId: 4, name: 'Understand resources for billing, budget, and cost management' },
      { id: '4.3', domainId: 4, name: 'Identify AWS technical resources and AWS Support options' },
    ],
  },
  'aif-c01': {
    code: 'aif-c01',
    provider: 'aws',
    level: 'foundational',
    name: 'AWS Certified AI Practitioner',
    shortName: 'AIF-C01',
    examQuestionCount: 65,
    examTimeSeconds: 5400,
    passingPercent: 67,
    status: 'active',
    examGuideVersion: 'AIF-C01 (1.1, April 2026)',
    examGuideUrl: 'https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html',
    domains: [
      { id: 1, name: 'Fundamentals of AI and ML', questionCount: 133, examProportion: 0.2 },
      { id: 2, name: 'Fundamentals of Generative AI', questionCount: 80, examProportion: 0.24 },
      { id: 3, name: 'Applications of Foundation Models', questionCount: 104, examProportion: 0.28 },
      { id: 4, name: 'Guidelines for Responsible AI', questionCount: 54, examProportion: 0.14 },
      { id: 5, name: 'Security, Compliance, and Governance', questionCount: 48, examProportion: 0.14 },
    ],
    taskStatements: [
      { id: '1.1', domainId: 1, name: 'Explain basic AI concepts and terminologies' },
      { id: '1.2', domainId: 1, name: 'Identify practical use cases for AI' },
      { id: '1.3', domainId: 1, name: 'Describe the ML development lifecycle' },
      { id: '2.1', domainId: 2, name: 'Explain the basic concepts of generative AI' },
      { id: '2.2', domainId: 2, name: 'Understand the capabilities and limitations of generative AI for solving business problems' },
      { id: '2.3', domainId: 2, name: 'Describe AWS infrastructure and technologies for building generative AI applications' },
      { id: '3.1', domainId: 3, name: 'Describe design considerations for applications that use foundation models' },
      { id: '3.2', domainId: 3, name: 'Choose effective prompt engineering techniques' },
      { id: '3.3', domainId: 3, name: 'Describe the training and fine-tuning process for foundation models' },
      { id: '3.4', domainId: 3, name: 'Describe methods to evaluate foundation model performance' },
      { id: '4.1', domainId: 4, name: 'Explain the development of AI systems that are responsible' },
      { id: '4.2', domainId: 4, name: 'Recognize the importance of transparent and explainable models' },
      { id: '5.1', domainId: 5, name: 'Explain methods to secure AI systems' },
      { id: '5.2', domainId: 5, name: 'Recognize governance and compliance regulations for AI systems' },
    ],
  },
  'saa-c03': {
    code: 'saa-c03',
    provider: 'aws',
    level: 'associate',
    name: 'AWS Solutions Architect Associate',
    shortName: 'SAA-C03',
    examQuestionCount: 65,
    examTimeSeconds: 7800,
    passingPercent: 69,
    status: 'coming-soon',
    examGuideVersion: 'SAA-C03 (2024)',
    domains: [
      { id: 1, name: 'Design Secure Architectures', questionCount: 5, examProportion: 0.3 },
      { id: 2, name: 'Design Resilient Architectures', questionCount: 5, examProportion: 0.26 },
      { id: 3, name: 'Design High-Performing Architectures', questionCount: 5, examProportion: 0.24 },
      { id: 4, name: 'Design Cost-Optimized Architectures', questionCount: 5, examProportion: 0.2 },
    ],
  },
};

/** Look up a certification by code. Returns null rather than throwing. */
export function getCert(code: string): Certification | null {
  return Object.prototype.hasOwnProperty.call(CERTIFICATIONS, code)
    ? (CERTIFICATIONS[code] ?? null)
    : null;
}

/** True when a cert may be practised. Coming-soon certs must not open flows. */
export function isActiveCert(code: string): boolean {
  return getCert(code)?.status === 'active';
}

/**
 * Every cert in a stable order: active first, then coming soon, then by short
 * name. Passing `activeOnly` removes the coming-soon entries entirely.
 */
export function listCerts(options: { activeOnly?: boolean } = {}): Certification[] {
  const order: Record<CertStatus, number> = { active: 0, 'coming-soon': 1 };
  return Object.values(CERTIFICATIONS)
    .filter((cert) => (options.activeOnly ? cert.status === 'active' : true))
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] || a.shortName.localeCompare(b.shortName),
    );
}

/**
 * Registry invariant checks. Returns human readable problems and is expected to
 * be empty; the spec asserts it on the real registry.
 */
export function validateRegistry(
  registry: Readonly<Record<string, Certification>> = CERTIFICATIONS,
): string[] {
  const problems: string[] = [];

  for (const [key, cert] of Object.entries(registry)) {
    if (cert.code !== key) {
      problems.push(`${key}: code does not match its registry key`);
    }
    if (cert.domains.length === 0) {
      problems.push(`${key}: declares no domains`);
    }
    const sum = cert.domains.reduce((total, domain) => total + domain.examProportion, 0);
    if (Math.abs(sum - 1) > 1e-9) {
      problems.push(
        `${key}: domain proportions sum to ${sum}, not 1. The last domain must absorb the remainder.`,
      );
    }
    const ids = new Set<number>();
    for (const domain of cert.domains) {
      if (ids.has(domain.id)) {
        problems.push(`${key}: duplicate domain id ${domain.id}`);
      }
      ids.add(domain.id);
      if (domain.questionCount < 0) {
        problems.push(`${key}: domain ${domain.id} has a negative question count`);
      }
    }
    for (const task of cert.taskStatements ?? []) {
      if (!ids.has(task.domainId)) {
        problems.push(
          `${key}: task statement ${task.id} points at unknown domain ${task.domainId}`,
        );
      }
    }
    if (cert.passingPercent < 0 || cert.passingPercent > 100) {
      problems.push(`${key}: passing percent ${cert.passingPercent} is outside 0 to 100`);
    }
  }

  return problems;
}

