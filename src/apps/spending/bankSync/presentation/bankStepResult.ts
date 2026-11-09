import type { BankSyncOutcome } from '../application/bankSync'
import type { OlderRowsMissing } from '../application/bankRead'
import { setupLines } from '../domain/bankAccountSetup'
import type { AccountProposal, LinkedOfBank, SetupLine } from '../domain/bankAccountSetup'
import type { BalanceDifference } from '../domain/bankBalance'
import { words } from './words'
import { SPENDING_BANK_SYNC_LINK, SPENDING_REVIEW_LINK } from '../../overview/presentation/spendingLinks'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { absAccountMoney, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import type { StepResult } from '../../../../shared/sync/application/syncRun'
import { plural } from '../../../../shared/text/translation'

type BookNow = Pick<SpendingBook, 'accounts' | 'transactions' | 'settings'>

function waitingLine(line: SetupLine): readonly string[] {
  if (line.kind === 'missing') return [words.unknownAccount(words.banks[line.bank], line.currency, line.linked.iban)]
  if (line.kind === 'fits') return [words.fitsAccount(words.banks[line.bank], line.update.currency, line.account.name)]
  return []
}

/** One line for each linked account Kuna neither keeps nor was told to leave out, as the file stands now. */
export function waitingAccountLines(linked: readonly LinkedOfBank[], proposals: readonly AccountProposal[], book: BookNow): readonly string[] {
  return setupLines(linked, proposals, book).flatMap(waitingLine)
}

export function olderRowsLine({ bank, account, reached }: OlderRowsMissing): string {
  return reached === null ? words.noOlderRows(words.banks[bank], account.name) : words.olderRows(words.banks[bank], account.name, dayLabel(reached))
}

export function differenceLine({ account, stated, worked }: BalanceDifference): string {
  return words.balanceDiffers(account.name, formatAccountMoney(stated, account.currency), formatAccountMoney(worked, account.currency))
}

/** The plain line for a difference the bank's pending rows make up in full. */
export function pendingLine({ account, stated, worked }: BalanceDifference): string {
  const difference = subtractAccountMoney(stated, worked)
  const amount = formatAccountMoney(absAccountMoney(difference), account.currency)
  return difference < 0 ? words.pendingPayments(account.name, amount) : words.pendingIncoming(account.name, amount)
}

/** What the warning adds while the bank holds pending rows that do not make up the difference: how much is pending and how much is left unexplained. */
export function pendingCaption({ account, stated, worked, pending }: BalanceDifference & { readonly pending: AccountMoney }): string {
  const amount = formatAccountMoney(absAccountMoney(pending), account.currency)
  const rest = formatAccountMoney(absAccountMoney(subtractAccountMoney(subtractAccountMoney(stated, worked), pending)), account.currency)
  return pending < 0 ? words.pendingPaymentsCaption(amount, rest) : words.pendingIncomingCaption(amount, rest)
}

/** What a fetch left for you to act on: each bank that gave no rows, and each kept account whose older rows only a new link brings. */
export function bankProblemLines({ problems, olderRows }: Pick<BankSyncOutcome, 'problems' | 'olderRows'>): readonly string[] {
  return [...problems, ...olderRows.map(olderRowsLine)]
}

function waiting(line: string, writeId: number | null): StepResult {
  return { kind: 'waits', line, writeId, link: { label: words.step.settings, to: SPENDING_BANK_SYNC_LINK } }
}

/** A step that left something for you waits with a link to where it shows, and stays waiting while it holds back the next fetch, leaving out an account added since. */
export function bankHeldResult(problems: readonly string[], linked: readonly LinkedOfBank[], book: BookNow | null): StepResult {
  const left = [...problems, ...(book === null ? [] : waitingAccountLines(linked, [], book))]
  const line = [words.step.tooSoon, ...left].join(' ')
  return left.length === 0 ? { kind: 'done', line, writeId: null, link: null } : waiting(line, null)
}

/** What the step says of a fetch: the summary and notes, each balance that differs, and what it left for you. A difference pending rows make up is in the notes already. */
export function bankStepResult(outcome: BankSyncOutcome, book: BookNow | null, writeId: number | null, toReview: number): StepResult {
  const left = [...bankProblemLines(outcome), ...(book === null ? [] : waitingAccountLines(outcome.linked, outcome.proposals, book))]
  const { newRows, alreadyIn, filled, notes } = outcome.dryRun
  const line = [words.summary(newRows, alreadyIn, filled), ...notes, ...outcome.differences.filter((difference) => !difference.explained).map(differenceLine), ...left].join(' ')
  if (left.length > 0) return waiting(line, writeId)
  return { kind: 'done', line, writeId, link: toReview === 0 ? null : { label: plural(words.step.review(toReview), toReview), to: SPENDING_REVIEW_LINK } }
}
