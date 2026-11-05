import type { BankRead, BankSyncOutcome } from '../application/bankSync'
import { words } from './words'
import { SPENDING_BANK_SYNC_LINK, SPENDING_REVIEW_LINK } from '../../overview/presentation/spendingLinks'
import type { StepResult } from '../../../../shared/sync/application/syncRun'
import { plural } from '../../../../shared/text/translation'

/** What a fetch left for you to look at: each bank that gave no rows, and each linked account Kuna does not keep. */
export function bankProblemLines({ problems, unknown }: Pick<BankRead, 'problems' | 'unknown'>): readonly string[] {
  return [...problems, ...unknown.map(({ bank, account }) => words.unknownAccount(words.banks[bank], account.iban))]
}

/** A step that left something for you waits with a link to where it shows, and stays waiting while it holds back the next fetch. */
export function bankHeldResult(problems: readonly string[]): StepResult {
  const line = [words.step.tooSoon, ...problems].join(' ')
  return problems.length === 0 ? { kind: 'done', line, writeId: null, link: null } : { kind: 'waits', line, writeId: null, link: { label: words.step.settings, to: SPENDING_BANK_SYNC_LINK } }
}

/** What the step says of a fetch: the summary and notes, and what it left for you. */
export function bankStepResult(outcome: BankSyncOutcome, writeId: number | null, toReview: number): StepResult {
  const problems = bankProblemLines(outcome)
  const { newRows, alreadyIn, filled, notes } = outcome.dryRun
  const line = [words.summary(newRows, alreadyIn, filled), ...notes, ...problems].join(' ')
  if (problems.length > 0) return { kind: 'waits', line, writeId, link: { label: words.step.settings, to: SPENDING_BANK_SYNC_LINK } }
  return { kind: 'done', line, writeId, link: toReview === 0 ? null : { label: plural(words.step.review(toReview), toReview), to: SPENDING_REVIEW_LINK } }
}
