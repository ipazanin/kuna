import { INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { words as settingsWords } from '../../settings/presentation/words'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from '../../workbook/domain/investmentKinds'
import { TEXT, TEXT_OR_NULL, found, inputOf } from '../../../../shared/app/operationInput'
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

/** Accounts at a broker, as the account dialog adds, changes and deletes them. One that records name keeps them, so its deletion is refused. */
export const ACCOUNT_STEPS: InvestmentSteps = {
  operations: [
    {
      name: 'add-account',
      about: 'A new account at a broker, which trades, income and cash movements name.',
      input: inputOf({ name: TEXT, note: TEXT }),
      refs: {},
      creates: INVESTMENT_ACCOUNT_RECORDS.name,
      alone: false,
      example: { name: 'Broker, long term', note: '' },
    },
    {
      name: 'change-account',
      about: 'A new name or note for an account. Null leaves a field as it is.',
      input: inputOf({ account: TEXT, name: TEXT_OR_NULL, note: TEXT_OR_NULL }),
      refs: { account: INVESTMENT_ACCOUNT_RECORDS.name },
      creates: null,
      alone: false,
      example: { account: 'account', name: 'Renamed', note: null },
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
        const account: InvestmentAccount = { id: recordIdOf(INVESTMENT_ACCOUNT_RECORDS, newRecordId()), name: nameOf(field['name']), note: (field['note'] as string).trim() }
        unit.of(INVESTMENT_ACCOUNT_WRITES).add(account)
        return { book: { ...card.book, accounts: [...card.book.accounts, account] }, made: account.id, fetchesPricesOf: null }
      }
      case 'change-account': {
        const before = accountOf(field['account'])
        const name = field['name'] === null ? before.name : nameOf(field['name'])
        const note = field['note'] === null ? before.note : (field['note'] as string).trim()
        unit.of(INVESTMENT_ACCOUNT_WRITES).change(before, { ...before, name, note })
        return unchanged(card)
      }
      default:
        unit.of(INVESTMENT_ACCOUNT_WRITES).remove(accountOf(field['account']))
        return unchanged(card)
    }
  },
}
