import type { BankSyncOutcome } from '../application/bankSync'
import type { OlderRowsMissing } from '../application/bankRead'
import { linkedAccountEnding, setupLineCurrency, setupLines } from '../domain/bankAccountSetup'
import type { AccountProposal, LinkedOfBank, SetupLine } from '../domain/bankAccountSetup'
import type { BalanceDifference, StatedBalance } from '../domain/bankBalance'
import { words } from './words'
import { dryRunNotes } from '../../statements/presentation/readingLines'
import { SPENDING_BANK_SYNC_LINK, SPENDING_REVIEW_LINK } from '../../overview/presentation/spendingLinks'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import type { StepResult } from '../../../../shared/sync/application/syncRun'
import { sameBank } from '../../../../shared/recipes/domain/savedRecipe'
import { listInWords } from '../../../../shared/text/listInWords'
import { listed, plural } from '../../../../shared/text/translation'

type BookNow = Pick<SpendingBook, 'accounts' | 'transactions' | 'settings'>

/** What the linked accounts leave as the file stands now: a kept account to update with the bank's details waits for you, and the accounts Kuna does not keep are only a note, since never adding them is fine. */
interface AccountLines {
  readonly waiting: readonly string[]
  readonly notes: readonly string[]
}

const NO_ACCOUNT_LINES: AccountLines = { waiting: [], notes: [] }

/** An account Kuna does not keep by its bank and currency, with the end of its number only when another account of the fetch or of the file has the same bank and currency. */
function missingAccountName(missing: Extract<SetupLine, { kind: 'missing' }>, lines: readonly SetupLine[], book: BookNow): string {
  const alike =
    lines.some((line) => line !== missing && line.bank === missing.bank && setupLineCurrency(line) === missing.currency) ||
    book.accounts.some((account) => sameBank(account.bank, missing.bank) && account.currency === missing.currency)
  return words.linkedAccount(missing.bank, missing.currency, alike ? linkedAccountEnding(missing.linked) : '')
}

function accountLines(linked: readonly LinkedOfBank[], proposals: readonly AccountProposal[], book: BookNow | null): AccountLines {
  if (book === null) return NO_ACCOUNT_LINES
  const lines = setupLines(linked, proposals, book)
  const missing = lines.flatMap((line) => (line.kind === 'missing' ? [missingAccountName(line, lines, book)] : []))
  return {
    waiting: lines.flatMap((line) => (line.kind === 'fits' ? [words.fitsAccount(line.bank, line.update.currency, line.account.name)] : [])),
    notes: missing.length === 0 ? [] : [listed(words.unknownAccounts(missing.length, listInWords(missing)), missing.length)],
  }
}

export function olderRowsLine({ link, account, reached }: OlderRowsMissing): string {
  return reached === null ? words.noOlderRows(link.bank, account.name) : words.olderRows(link.bank, account.name, dayLabel(reached))
}

export function differenceLine({ account, stated, worked }: BalanceDifference): string {
  return words.balanceDiffers(account.name, formatAccountMoney(stated, account.currency), formatAccountMoney(worked, account.currency))
}

/** A line for each account whose bank holds money as not booked yet without listing it as a row, as a bank may for a transfer out that has not booked. */
export function unlistedLines(stated: readonly StatedBalance[]): readonly string[] {
  return stated.flatMap(({ account, unlisted }) => (unlisted === null ? [] : [words.unlistedPending(account.name, formatAccountMoney(absAccountMoney(unlisted), account.currency))]))
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

/** What the step says of a fetch: the summary and notes with the money each bank holds unlisted, then what it left for you, each balance that differs first, then the accounts Kuna does not keep. */
export function bankStepResult(outcome: BankSyncOutcome, book: BookNow | null, writeId: number | null, toReview: number): StepResult {
  const accounts = accountLines(outcome.linked, outcome.proposals, book)
  const differences = outcome.differences.map(differenceLine)
  const left = [...differences, ...bankProblemLines(outcome), ...accounts.waiting]
  const { newRows, alreadyIn, filled } = outcome.dryRun
  const line = [words.summary(newRows, alreadyIn, filled), ...dryRunNotes(outcome.dryRun, book?.accounts ?? []), ...unlistedLines(outcome.stated), ...left, ...accounts.notes].join(' ')
  if (left.length > 0) return { kind: 'waits', line, writeId, link: SETTINGS_LINK }
  if (toReview > 0) return { kind: 'done', line, writeId, link: { label: plural(words.step.review(toReview), toReview), to: SPENDING_REVIEW_LINK } }
  return { kind: 'done', line, writeId, link: accounts.notes.length === 0 ? null : SETTINGS_LINK }
}
