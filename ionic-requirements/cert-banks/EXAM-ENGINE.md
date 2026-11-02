# Building exams like CloudCertPrep

This folder is a self-contained reference for porting the CloudCertPrep exam
engine to an Ionic and Angular application. It contains:

- `banks/` - all cert question banks, copied from `src/data/`.
- `reference/` - the relevant source files from the web app.
- `EXAM-ENGINE.md` - this guide.

The banks and reference files are copies for study and porting. The running web
app remains the source of truth. The copies were sanitised to remove en and em
dashes so this docs folder obeys the repository rule.

## What an exam is

There are two exam modes:

1. **Mock exam**: timed, no feedback until submission, scored, pass or fail.
2. **Study exam**: untimed, immediate feedback, per-option explanations, saved
   after every answer, resumable.

Both use the same question set composition:

- the cert's configured exam question count,
- the cert's domain proportions,
- a random question order,
- randomly shuffled answer options.

They differ in timing, feedback, and persistence, not in which questions they
choose.

## Folder map

| Path | What it is |
|---|---|
| `banks/clf-c02/domain1.json` to `domain4.json` | AWS Cloud Practitioner bank, 1,050 questions |
| `banks/aif-c01/domain1.json` to `domain5.json` | AWS AI Practitioner bank, 419 questions |
| `banks/saa-c03/domain1.json` to `domain4.json` | Solutions Architect placeholder bank, 20 questions, coming soon |
| `reference/certifications.ts` | Cert registry: counts, times, pass scores, domains, proportions |
| `reference/questions.ts` | Domain loaders and question cache |
| `reference/types.ts` | `Question`, `Certification`, domain and attempt shapes |
| `reference/scoring.ts` | Question selection, grading, scaled score, timing |
| `reference/utils.ts` | Shuffle, option remap, answer encoding, multi toggle |
| `reference/spacedRepetition.ts` | Practice selection, not used by exams |
| `reference/domainStats.ts` | Mastery and next-domain logic |
| `reference/constants.ts` | Shared constants and limits |
| `reference/supabaseUtils.ts` | Web progress update reference, server-specific |
| `reference/validate-questions.mjs` | Web question validator, useful as a schema check |
| `reference/scoring.test.ts` | Behaviour specs for scoring, grading, timing, and domain targets |
| `reference/spacedRepetition.test.ts` | Behaviour specs for practice selection |
| `reference/domainStats.test.ts` | Behaviour specs for mastery and next-domain logic |
| `reference/utils.test.ts` | Behaviour specs for shuffling and answer remapping |
| `reference/questionTypes.integration.test.ts` | Real-bank round-trip tests for ordering and matching |

## Cert registry

The registry is the single source of truth for exam logistics. Each cert has:

```ts
{
  code: 'clf-c02',
  provider: 'aws',
  level: 'foundational',
  name: 'AWS Cloud Practitioner',
  shortName: 'CLF-C02',
  examQuestionCount: 65,
  examTimeSeconds: 90 * 60,
  passingScore: 700,
  domains: [
    { id: 1, name: 'Cloud Concepts', examProportion: 0.24, questionCount: 187 },
    // ...
  ],
  status: 'active',
}
```

Key facts:

| Cert | Questions in bank | Exam questions | Time | Passing score | Status |
|---|---|---|---|---|---|
| CLF-C02 | 1,050 | 65 | 90 minutes | 700 | Active |
| AIF-C01 | 419 | 65 | 90 minutes | 700 | Active |
| SAA-C03 | 20 | 65 | 130 minutes | 720 | Coming soon |

The `examProportion` values must sum to 1.0. The last domain absorbs the rounding
remainder so the exam always contains exactly `examQuestionCount` questions.

## Question schema

Every question is a JSON object. The current schema after the explanation
refactor is:

```json
{
  "id": "q004",
  "question": "Which of the following are related to AWS reliability?",
  "options": {
    "A": "Applying least privilege",
    "B": "Automatically provisioning resources to meet demand",
    "C": "Treating every service as global",
    "D": "Providing service credits",
    "E": "Recovering quickly from failures"
  },
  "answer": ["B", "E"],
  "explanation": {
    "summary": "Automatic provisioning and quick recovery are core reliability principles.",
    "options": {
      "A": "Least privilege is a security practice, not a reliability principle.",
      "B": "Correct answer. Automatic provisioning matches demand and keeps the system reliable.",
      "C": "Many AWS services are regional, so this statement is false.",
      "D": "Service credits are an SLA remedy, not a reliability design principle.",
      "E": "Correct answer. Quick recovery is a core reliability principle."
    }
  },
  "note": "Reliability means the system keeps working under load and recovers quickly from failure.",
  "isMultiAnswer": true,
  "taskStatement": "1.2",
  "lastVerified": "2026-06-15",
  "services": []
}
```

Rules:

- `id` is unique across the cert.
- `question` is plain text. No HTML or Markdown.
- `options` has 2 to 5 non-empty keys from `A` to `E`.
- `answer` is a string for single answer, an array for multi answer.
- `explanation.summary` is the correct-answer rationale.
- `explanation.options` has one string for every non-empty option key.
  - Correct options say why they are correct.
  - Incorrect options say why they are wrong.
  - Ordering options state the correct position.
  - Matching options state the correct target.
- `note` is a short takeaway, one sentence or a compact paragraph.
- `isMultiAnswer` is true only for multi answer.
- `type` is optional. If absent, infer `multi` when `isMultiAnswer` is true,
  otherwise `single`.

### Answer formats

Single answer:

```json
{ "answer": "B", "isMultiAnswer": false }
```

Multi answer:

```json
{ "answer": ["B", "E"], "isMultiAnswer": true }
```

Ordering:

```json
{
  "type": "ordering",
  "answer": "",
  "isMultiAnswer": false,
  "correctOrder": ["D", "B", "A", "C"]
}
```

Matching:

```json
{
  "type": "matching",
  "answer": "",
  "isMultiAnswer": false,
  "targets": { "1": "First target", "2": "Second target" },
  "correctMatches": { "A": "2", "B": "1" }
}
```

## Loading the bank

The web app registers one loader per cert and domain. The loader imports the
JSON and stamps each question with its `domainId`, because the JSON files do not
store it.

```ts
export async function loadDomainQuestions(certCode: string, domainId: number): Promise<Question[]> {
  const mod = await loader()
  return mod.default.map(q => ({ ...q, domainId }))
}

export async function loadAllQuestions(certCode: string): Promise<Question[]> {
  const domainIds = Object.keys(loaders[certCode]).map(Number)
  const results = await Promise.all(domainIds.map(id => loadDomainQuestions(certCode, id)))
  return results.flat()
}
```

For Ionic and Angular:

- Bundle the JSON as app assets or import them directly.
- Keep one loader map so a cert can be added without changing scoring code.
- Cache loaded domains in memory for the session.
- Do not fetch questions from a server.

## Creating a mock exam

The mock exam uses `selectExamQuestions`:

```ts
export function selectExamQuestions(allQuestions: Question[], cert: Certification): Question[] {
  const targets = getExamDomainTargets(cert)
  const selected: Question[] = []
  for (const [domainId, count] of Object.entries(targets)) {
    const domainQs = fisherYatesShuffle(
      allQuestions.filter(q => q.domainId === Number(domainId))
    ).slice(0, count)
    selected.push(...domainQs)
  }
  return fisherYatesShuffle(selected)
}
```

The domain targets algorithm:

```ts
export function getExamDomainTargets(cert: Certification): Record<number, number> {
  const targets: Record<number, number> = {}
  let assigned = 0
  cert.domains.forEach((domain, i) => {
    if (i === cert.domains.length - 1) {
      targets[domain.id] = cert.examQuestionCount - assigned
    } else {
      const count = Math.round(cert.examQuestionCount * domain.examProportion)
      targets[domain.id] = count
      assigned += count
    }
  })
  return targets
}
```

Example for CLF-C02 with 65 questions:

- Domain 1: `round(65 * 0.24) = 16`
- Domain 2: `round(65 * 0.30) = 20`
- Domain 3: `round(65 * 0.34) = 22`
- Domain 4: remainder `65 - 16 - 20 - 22 = 7`

Then shuffle the final list so domains are mixed.

## Shuffling options

Question order is shuffled. Option order is also shuffled per attempt, while the
correct answer mapping is preserved.

`shuffleQuestionOptions` returns:

- the question with shuffled option content,
- a `keyMap` from display keys back to original bank keys.

Rules:

- Display labels stay `A` to `E`.
- Only the content behind each label moves.
- Remap `answer`, `correctOrder`, and the left side of `correctMatches`.
- Do not shuffle matching targets. The right column stays `1` to `5`.
- When saving, convert display keys back to original keys with `keyMap`.
- When loading history, the original bank plus original keys renders correctly.

The `encodeAnswerForDb` helper shows the persisted shapes:

- single and ordering: comma-joined keys,
- multi: comma-joined keys,
- matching: comma-joined `optionKey:targetKey` tokens.

Even if the Ionic app uses a local JSON column instead of text, keeping this
canonical shape simplifies import and export.

## Grading

Grading is all-or-nothing. There is no partial credit.

| Type | Comparison |
|---|---|
| single | Strict string equality |
| multi | Set equality, order independent |
| matching | Set equality over `K:T` tokens, order independent |
| ordering | Positional array equality, order dependent |

The correct answer for a question comes from `answer`, `correctOrder`, or
`correctMatches`. See `correctAnswerFor` in `reference/scoring.ts`.

## Scoring

Scaled score maps raw percentage to the AWS 100 to 1000 scale:

```ts
export function calculateScaledScore(correct: number, total: number): number {
  const rawPercent = correct / total
  const scaled = Math.round(100 + rawPercent * 900)
  return Math.min(1000, Math.max(100, scaled))
}
```

Pass or fail uses the cert threshold:

```ts
export function isPassed(scaledScore: number, passingScore: number): boolean {
  return scaledScore >= passingScore
}
```

Per-domain score:

```ts
const domainQuestions = results.filter(r => r.domainId === domainId)
const correct = domainQuestions.filter(r => r.isCorrect).length
const percent = Math.round((correct / domainQuestions.length) * 100)
```

## Timing

Use absolute timestamps, not an in-memory countdown.

- Store `startedAt` when the exam begins.
- Store the deadline as `startedAt + examTimeSeconds * 1000`.
- Compute remaining time from `Date.now()`.
- Clamp the saved `timeTaken` to `[0, examTimeSeconds]`.
- A forward clock jump or device sleep must not inflate saved time.
- A backward clock jump must not discard a completed attempt.

This matters on a phone because the app can be backgrounded or the screen can
lock.

## Study exams

A study exam uses the same question set as the mock exam but behaves differently.

| Aspect | Mock exam | Study exam |
|---|---|---|
| Timer | Yes | No |
| Feedback | After submission | Immediately after each answer |
| Explanation | Review after submission | Per answer, per option |
| Progress bars | One main progress | Three: answered, correct, wrong |
| Save timing | At submit | After every answer |
| Resume | Yes | Yes |
| Per-domain scores | Yes | Yes |
| History | Yes | Yes |
| Best score | Yes | Yes |

Feedback rules:

- For a fully correct answer, show `explanation.summary`.
- For an incorrect answer, show `explanation.options[key]` for each selected
  wrong option and each correct option.
- For a partial multi-answer, cover both the selected wrong options and the
  omitted correct options.
- Answered questions are read-only until submission.
- The student can return to an earlier answered question and see the exact
  answer and feedback.

Three progress bars:

- Answered: `answered / totalQuestions`.
- Correct: `correct / totalQuestions`.
- Wrong: `wrong / totalQuestions`.
- Correct plus wrong equals answered.
- Correct bar gradient: light green to dark green.
- Wrong bar gradient: intense orange to deep red.
- Total bar shifts from light green to intense orange based on accuracy.
- Each bar has a text label, a numeric value, and accessible progress values.

## Practice selection is different

Domain practice uses adaptive weighted sampling, not the exam selector. Do not
reuse the exam selection for practice.

- Guests or a single local user with no history: uniform random.
- With history: unseen quota of `ceil(count * 0.2)`, then weighted draw without
  replacement, then backfill excluded questions oldest-first.
- There is no due-date scheduler and no calendar-based selection.

See `reference/spacedRepetition.ts` and `04-spaced-repetition.md`.

## Local persistence for Ionic

Suggested local entities:

| Entity | Key fields |
|---|---|
| `cert_progress` | cert, domain, attempted, correct, mastery, updated_at |
| `question_mastery` | cert, domain, question_id, streak, last_was_wrong, last_seen_at, mastered, weight |
| `attempts` | id, cert, kind, started_at, finished_at, score, scaled_score, passed, time_taken, total, correct, domain_scores |
| `attempt_questions` | attempt_id or null, cert, domain, question_id, user_answer, correct_answer, is_correct, was_flagged |
| `sessions` | id, cert, kind, question_order, current_index, answers, feedback, started_at, deadline, counters |
| `settings` | selected_cert, theme, reduced_motion, schema_version |

Use one transaction per answer:

1. Insert the question result.
2. Update the session.
3. Update the domain aggregate.
4. Update per-question mastery.

If any step fails, roll back. A failed write must be visible.

On native, use Capacitor SQLite. In the browser, use IndexedDB. Both behind one
repository interface. Share the schema and migrations.

## Angular and Ionic structure

A suggested structure:

```
src/app/
  core/
    exam/
      exam-engine.service.ts
      exam-scoring.ts
      exam-selection.ts
      exam-timing.ts
    practice/
      practice-selection.ts
    data/
      cert-registry.ts
      question-loader.ts
      question-bank.ts
    storage/
      study-repository.ts
      sqlite-study-repository.ts
      indexeddb-study-repository.ts
  features/
    mock-exam/
    study-exam/
    practice/
    dashboard/
    history/
    settings/
```

Keep the engine pure and framework independent:

- `selectExamQuestions(bank, cert)`
- `getExamDomainTargets(cert)`
- `shuffleQuestionOptions(question)`
- `isAnswerCorrect(user, correct, type)`
- `calculateScaledScore(correct, total)`
- `computeExamTiming(start, now, limit)`
- `selectPracticeQuestions(bank, count, mastery, userId)`

Call them from Angular services or components. Pure functions are easy to unit
test and reuse on web and native.

## Creating a new cert

1. Add a cert entry to the registry with code, provider, level, name, short
   name, exam question count, exam time, passing score, domains, and status.
2. Make the domain `examProportion` values sum to 1.0.
3. Add one JSON file per domain under `banks/<cert-code>/`.
4. Register the loader in the question loader map.
5. Run the validator.
6. Check the domain targets sum exactly to the exam question count.
7. Check every question has a `note` and a well-formed `explanation` object.
8. Smoke-test one mock exam and one study exam.

## Validation checklist

- Every question has `id`, `question`, `options`, `explanation`, and `note`.
- IDs are unique per cert.
- Options use only `A` to `E` and have at least two non-empty values.
- Single answers reference an option key.
- Multi answers are arrays of valid keys.
- Ordering `correctOrder` is a permutation of every non-empty option key.
- Matching `correctMatches` maps every option key to a valid target key, one to
  one.
- `explanation.summary` is non-empty.
- `explanation.options` covers every non-empty option key.
- No HTML, Markdown, em dashes, or en dashes in content.
- No leading or trailing whitespace.
- No missing space after a period.

## Porting gotchas

- Do not use the exam selector for practice. The two have different rules.
- Do not forget to remap answers back to original keys before saving.
- Do not shuffle matching targets, only the left option keys.
- The last domain absorbs rounding; do not round each domain independently
  without a remainder step.
- The timer must use wall-clock time and survive backgrounding.
- Study exam answers are read-only once graded.
- New study exams shuffle question order; resumed sessions keep their order.
- The local store must survive force close and app upgrades.
- The web IndexedDB adapter is for development and testing, not the primary
  store on a device.
- There is no login, no server, and no calendar-based scheduling.
