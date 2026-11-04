/**
 * Certification registry types.
 *
 * Kept separate from the registry data so the types can be imported by specs
 * and by the validator without pulling in the whole bank of cert data.
 */

export type CertProvider = 'aws' | 'azure' | 'gcp';

export type CertLevel = 'foundational' | 'associate' | 'professional' | 'specialty';

export type CertStatus = 'active' | 'coming-soon';

export interface CertDomain {
  id: number;
  name: string;
  /** Number of questions bundled for this domain in the shipped bank. */
  questionCount: number;
  /**
   * Share of the exam drawn from this domain. Every domain except the last is
   * rounded, and the last absorbs the remainder, so the exam always contains
   * exactly `examQuestionCount` questions (EXAM-2).
   */
  examProportion: number;
}

export interface TaskStatement {
  /** Exam guide task id, such as `1.2`. */
  id: string;
  domainId: number;
  name: string;
}

export interface Certification {
  code: string;
  provider: CertProvider;
  level: CertLevel;
  name: string;
  shortName: string;
  examQuestionCount: number;
  examTimeSeconds: number;
  /** Minimum score percentage required to pass. */
  passingPercent: number;
  domains: CertDomain[];
  status: CertStatus;
  /** Exam guide revision the bank was checked against, when known. */
  examGuideVersion?: string;
  examGuideUrl?: string;
  taskStatements?: TaskStatement[];
}
