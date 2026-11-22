import { datedPeriodsRefusal, periodsOfText } from '../../../../shared/app/accountSource'
import { writeInvestmentAccount } from '../../holdings/application/accountSourceWrites'
import { INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { accountSources, sourcesSaid } from '../../imports/domain/accountIntake'
import { words as settingsWords } from '../../settings/presentation/words'
import { BY_HAND_SOURCES, INVESTMENT_SOURCES } from '../../workbook/domain/investmentAccount'
import type { InvestmentAccount, InvestmentPeriod } from '../../workbook/domain/investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { TEXT, TEXT_OR_NULL, found, inputOf } from '../../../../shared/app/operationInput'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { unchanged } from './investmentSteps'
import type { InvestmentSteps } from './investmentSteps'

const SOURCES_ABOUT =
  'sources lists where its rows come from, in order, each later one followed by the day it takes over, such as by-hand, mail 2026-03-01. The first may carry its own day, before which the account takes no row, and mail first needs it. mail: IBKR report by mail. provider-file: an IBKR report you upload. by-hand: typing, imports and the chat. A day each source fills takes no row from another, and no day may reach a filed tax year.'

/** The periods a step lists, or `kept` on null. */
function sourcesOf(text: string | null, kept: readonly InvestmentPeriod[]): readonly InvestmentPeriod[] {
  if (text === null) return kept
  const periods = periodsOfText(text, INVESTMENT_SOURCES, parseCivilDate, 'may-have-day')
  if (periods === null || datedPeriodsRefusal(periods, ['mail']) !== null)
    throw new StepRefused(
      `Write sources as ${INVESTMENT_SOURCES.join(', ')} in order, each later one followed by the day it takes over, and mail first with its day, such as by-hand, mail 2026-03-01.`,
    )
  return periods
}

/** A name as the account dialog takes it, trimmed and never blank. */
function nameOf(text: string): string {
  const name = text.trim()
  if (name === '') throw new StepRefused(`name: ${settingsWords.accountDialog.nameError}`)
  return name
}

/**
 * Accounts at a broker, as the account dialog adds, changes and deletes them, each with where its rows come from. One that
 * records name keeps them, so its deletion is refused. Periods that reach into a filed tax year are refused, and the rows of
 * days a change gives another source go in the same write.
 */
export const ACCOUNT_STEPS: InvestmentSteps = {
  operations: [
    {
      name: 'add-account',
      about: `A new account at a broker, which trades, income and cash movements name. ${SOURCES_ABOUT} Null is by-hand.`,
      input: inputOf({ name: TEXT, note: TEXT, sources: TEXT_OR_NULL }),
      refs: {},
      creates: INVESTMENT_ACCOUNT_RECORDS.name,
      alone: false,
      example: { name: 'Broker, long term', note: '', sources: 'mail 2026-11-01' },
    },
    {
      name: 'change-account',
      about: `A new name, note or sources for an account. Null leaves a field as it is. ${SOURCES_ABOUT} The rows another source brought on the days a change gives away go, and the new source brings its own. Undo puts them back until it does.`,
      input: inputOf({ account: TEXT, name: TEXT_OR_NULL, note: TEXT_OR_NULL, sources: TEXT_OR_NULL }),
      refs: { account: INVESTMENT_ACCOUNT_RECORDS.name },
      creates: null,
      alone: false,
      example: { account: 'account', name: 'Renamed', note: null, sources: null },
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
          sources: sourcesOf(field['sources'], BY_HAND_SOURCES),
        }
        writeInvestmentAccount(unit, card.book, null, account)
        return { book: sourcesSaid({ ...card.book, accounts: [...card.book.accounts, account] }), made: account.id, fetchesPricesOf: [], notes: [], heldBack: [] }
      }
      case 'change-account': {
        const before = accountOf(field['account'])
        const name = field['name'] === null ? before.name : nameOf(field['name'])
        const note = field['note'] === null ? before.note : (field['note'] as string).trim()
        const after: InvestmentAccount = { ...before, name, note, sources: sourcesOf(field['sources'], accountSources(card.book).get(before.id) ?? BY_HAND_SOURCES) }
        writeInvestmentAccount(unit, card.book, before, after)
        return { ...unchanged(card), book: sourcesSaid({ ...card.book, accounts: card.book.accounts.map((account) => (account.id === before.id ? after : account)) }) }
      }
      default:
        unit.of(INVESTMENT_ACCOUNT_WRITES).remove(accountOf(field['account']))
        return unchanged(card)
    }
  },
}
