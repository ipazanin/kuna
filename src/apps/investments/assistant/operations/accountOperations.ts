import { INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { accountIntakes, landingRecords, proposedMailStart, sourcesSaid } from '../../imports/domain/accountIntake'
import { writeAccountSources } from '../../mail/application/mailReaderWrites'
import { words as settingsWords } from '../../settings/presentation/words'
import { BY_HAND, INVESTMENT_ROWS_FROM } from '../../workbook/domain/investmentAccount'
import type { AccountIntake, InvestmentAccount } from '../../workbook/domain/investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { TEXT, TEXT_OR_NULL, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import { today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { unchanged } from './investmentSteps'
import type { InvestmentSteps } from './investmentSteps'

/** A name as the account dialog takes it, trimmed and never blank. */
function nameOf(text: string): string {
  const name = text.trim()
  if (name === '') throw new StepRefused(`name: ${settingsWords.accountDialog.nameError}`)
  return name
}

const ROWS_FROM: StrictSchema = { type: 'string', enum: [...INVESTMENT_ROWS_FROM] }
const ROWS_FROM_OR_NULL: StrictSchema = { type: ['string', 'null'], enum: [...INVESTMENT_ROWS_FROM, null], description: 'Null leaves it.' }
const STARTS_ON: StrictSchema = {
  type: ['string', 'null'],
  description: 'With mail, the first day such as 2026-01-01 the report brings rows of. Null keeps the day it has, or takes the day after its last row typed or imported, else today. Null by hand.',
}

/** How the step says the account's rows come in, over how they come in now, null for a new account. Mail with no day keeps the one it has, or takes the day the dialog proposes. */
function intakeOf(rowsFromText: string | null, startsOnText: string | null, now: AccountIntake | null, proposed: CivilDate): AccountIntake {
  const rowsFrom = choiceOf(INVESTMENT_ROWS_FROM, rowsFromText, 'rowsFrom') ?? now?.rowsFrom ?? 'by-hand'
  if (rowsFrom === 'by-hand') {
    if (startsOnText !== null) throw new StepRefused('startsOn is for an account whose rows come from the mail.')
    return BY_HAND
  }
  if (startsOnText !== null) return { rowsFrom: 'mail', startsOn: dayOf(startsOnText) }
  return now?.rowsFrom === 'mail' ? now : { rowsFrom: 'mail', startsOn: proposed }
}

/**
 * Accounts at a broker, as the account dialog adds, changes and deletes them, each with how its rows come in. One that
 * records name keeps them, so its deletion is refused. A start day that reaches into a filed tax year or over rows by hand is refused.
 */
export const ACCOUNT_STEPS: InvestmentSteps = {
  operations: [
    {
      name: 'add-account',
      about:
        'A new account at a broker, which trades, income and cash movements name. rowsFrom mail: IBKR report by mail brings its rows from startsOn, and rows by hand go only on earlier days. by-hand: typing, imports and the chat.',
      input: inputOf({ name: TEXT, note: TEXT, rowsFrom: ROWS_FROM, startsOn: STARTS_ON }),
      refs: {},
      creates: INVESTMENT_ACCOUNT_RECORDS.name,
      alone: false,
      example: { name: 'Broker, long term', note: '', rowsFrom: 'mail', startsOn: '2026-11-01' },
    },
    {
      name: 'change-account',
      about: 'A new name, note, rowsFrom or startsOn for an account. Null leaves a field as it is.',
      input: inputOf({ account: TEXT, name: TEXT_OR_NULL, note: TEXT_OR_NULL, rowsFrom: ROWS_FROM_OR_NULL, startsOn: TEXT_OR_NULL }),
      refs: { account: INVESTMENT_ACCOUNT_RECORDS.name },
      creates: null,
      alone: false,
      example: { account: 'account', name: 'Renamed', note: null, rowsFrom: null, startsOn: null },
    },
    {
      name: 'delete-account',
      about: 'Deletes an account that no trade, income, cash movement, exchange, transfer or target names.',
      input: inputOf({ account: TEXT }),
      refs: { account: INVESTMENT_ACCOUNT_RECORDS.name },
      creates: null,
      alone: false,
      example: { account: 'account-empty' },
    },
  ],
  write(unit, card, { operation, input }) {
    const field = input as Readonly<Record<string, never>>
    const accountOf = (value: unknown): InvestmentAccount => found(card.book.accounts, card.idOf(value), 'account')
    switch (operation) {
      case 'add-account': {
        const id = recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newRecordId())
        const account: InvestmentAccount = {
          id,
          name: nameOf(field['name']),
          note: (field['note'] as string).trim(),
          intake: intakeOf(field['rowsFrom'], field['startsOn'], null, proposedMailStart(id, [], today())),
        }
        unit.of(INVESTMENT_ACCOUNT_WRITES).add(account)
        writeAccountSources(unit, card.book, {})
        return { book: sourcesSaid({ ...card.book, accounts: [...card.book.accounts, account] }), made: account.id, fetchesPricesOf: [], notes: [], heldBack: [] }
      }
      case 'change-account': {
        const before = accountOf(field['account'])
        const name = field['name'] === null ? before.name : nameOf(field['name'])
        const note = field['note'] === null ? before.note : (field['note'] as string).trim()
        const proposed = proposedMailStart(before.id, landingRecords(card.book), today())
        const intake = intakeOf(field['rowsFrom'], field['startsOn'], accountIntakes(card.book).get(before.id) ?? null, proposed)
        const after: InvestmentAccount = { ...before, name, note, intake }
        unit.of(INVESTMENT_ACCOUNT_WRITES).change(before, after)
        writeAccountSources(unit, card.book, { account: before.id })
        return { ...unchanged(card), book: sourcesSaid({ ...card.book, accounts: card.book.accounts.map((account) => (account.id === before.id ? after : account)) }) }
      }
      default:
        unit.of(INVESTMENT_ACCOUNT_WRITES).remove(accountOf(field['account']))
        return unchanged(card)
    }
  },
}
