import type { BankSyncOutcome } from '../application/bankSync'
import type { OlderRowsMissing } from '../application/bankRead'
import { linkedAccountEnding, setupLines } from '../domain/bankAccountSetup'
import type { AccountProposal, LinkedOfBank } from '../domain/bankAccountSetup'
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

/** What the linked accounts leave as the file stands now: a kept account to update with the bank's details waits for you, and an account Kuna does not keep is only a note, since never adding it is fine. */
interface AccountLines {
  readonly waiting: readonly string[]
  readonly notes: readonly string[]
}

const NO_ACCOUNT_LINES: AccountLines = { waiting: [], notes: [] }

function accountLines(linked: readonly LinkedOfBank[], proposals: readonly AccountProposal[], book: BookNow | null): AccountLines {
  if (book === null) return NO_ACCOUNT_LINES
  const lines = setupLines(linked, proposals, book)
  return {
    waiting: lines.flatMap((line) => (line.kind === 'fits' ? [words.fitsAccount(words.banks[line.bank], line.update.currency, line.account.name)] : [])),
    notes: lines.flatMap((line) => (line.kind === 'missing' ? [words.unknownAccount(words.linkedAccount(words.banks[line.bank], line.currency, linkedAccountEnding(line.linked)))] : [])),
  }
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

const SETTINGS_LINK = { label: words.step.settings, to: SPENDING_BANK_SYNC_LINK }

/** A step that left something for you waits with a link to where it shows, and stays waiting while it holds back the next fetch, leaving out an account added since. */
export function bankHeldResult(problems: readonly string[], linked: readonly LinkedOfBank[], book: BookNow | null): StepResult {
  const accounts = accountLines(linked, [], book)
  const left = [...problems, ...accounts.waiting]
  const line = [words.step.tooSoon, ...left, ...accounts.notes].join(' ')
  if (left.length > 0) return { kind: 'waits', line, writeId: null, link: SETTINGS_LINK }
  return { kind: 'done', line, writeId: null, link: accounts.notes.length === 0 ? null : SETTINGS_LINK }
}

/** What the step says of a fetch: the summary and notes, then what it left for you, each balance that differs first, then the accounts Kuna does not keep. A difference pending rows make up is in the notes already. */
export function bankStepResult(outcome: BankSyncOutcome, book: BookNow | null, writeId: number | null, toReview: number): StepResult {
  const accounts = accountLines(outcome.linked, outcome.proposals, book)
  const differences = outcome.differences.filter((difference) => !difference.explained).map(differenceLine)
  const left = [...differences, ...bankProblemLines(outcome), ...accounts.waiting]
  const { newRows, alreadyIn, filled, notes } = outcome.dryRun
  const line = [words.summary(newRows, alreadyIn, filled), ...notes, ...left, ...accounts.notes].join(' ')
  if (left.length > 0) return { kind: 'waits', line, writeId, link: SETTINGS_LINK }
  if (toReview > 0) return { kind: 'done', line, writeId, link: { label: plural(words.step.review(toReview), toReview), to: SPENDING_REVIEW_LINK } }
  return { kind: 'done', line, writeId, link: accounts.notes.length === 0 ? null : SETTINGS_LINK }
}
