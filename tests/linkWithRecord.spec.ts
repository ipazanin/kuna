import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { addAndLink } from '../src/apps/spending/links/application/linkWithRecord'
import { addLoansExtraPayment, addLoansMovement } from '../src/apps/spending/links/application/loanTargets'
import type { ShownTarget } from '../src/apps/spending/links/application/linkTargets'
import type { InformalLoanTarget, InstalmentTarget } from '../src/apps/spending/links/domain/linkTarget'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromAmount } from '../src/shared/money/money'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { ACCOUNTS, CATEGORIES, OTP, row, wholeItems } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const loans = vi.hoisted(() => ({ added: [] as unknown[], undone: 0, refuse: null as string | null, refuseUndo: null as string | null }))
vi.mock('../src/apps/loans/facts', async (original) => ({
  ...(await original<typeof import('../src/apps/loans/facts')>()),
  addMovement: async (movement: unknown) => {
    if (loans.refuse !== null) throw new Error(loans.refuse)
    loans.added.push(movement)
    return {
      link: { app: 'loans', kind: 'movement', key: 'made-up-movement', due: null },
      undo: async () => {
        if (loans.refuseUndo !== null) throw new Error(loans.refuseUndo)
        loans.undone += 1
      },
    }
  },
  addExtraPayment: async (payment: unknown) => {
    loans.added.push(payment)
    return { link: { app: 'loans', kind: 'extra-payment', key: 'made-up-extra-payment', due: null }, undo: async () => void (loans.undone += 1) }
  },
}))

const on = (date: string) => parseCivilDate(date)!
const MARKO: ShownTarget & InformalLoanTarget = {
  kind: 'informal-loan',
  link: { app: 'loans', kind: 'informal-loan', key: 'made-up-loan', due: null },
  name: 'To Marko',
  counterparty: 'Marko',
  direction: 'owed-to-you',
  to: { path: '/loans' },
}
const LENT = { day: on('2026-11-20'), kind: 'borrowed' as const, amount: moneyFromAmount(300), note: '' }
const TITLES = { inLoans: 'Movement added from Spending', linked: 'Entry linked' }

describe('adding a movement in Loans from a row', () => {
  const used = new Set<string>()
  afterEach(async () => {
    Object.assign(loans, { added: [], undone: 0, refuse: null, refuseUndo: null })
    await forgetCaches(used)
  })

  function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
    const codec = codecOfSpendingKind(kind)
    return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
  }

  const paid = row(OTP, '2026-11-20', -300, 'Food/Groceries')

  async function fileWithPaid() {
    const document = spendingDocumentOf('2026-11-20T09:00:00.000Z', {
      ...stored(ACCOUNT_RECORDS, ACCOUNTS),
      ...stored(CATEGORY_RECORDS, CATEGORIES),
      ...stored(TRANSACTION_RECORDS, [storedRowOf(paid, BLANK_CELLS)]),
      ...stored(ITEM_RECORDS, wholeItems([paid])),
    })
    const { store } = await browserHarness(used, document, SPENDING)
    const place = { currency: OTP.currency, categories: store.state.workbook!.categories, language: 'en' as const, notes: { interest: 'Interest', difference: 'Difference' } }
    return { store, place, entry: store.state.workbook!.transactions[0]! }
  }

  it('adds the movement first, links the row to it under Loans to and from people, and one Undo takes back the link and then the movement', async () => {
    const { store, place, entry } = await fileWithPaid()
    const result = await addAndLink(store, entry, () => addLoansMovement(MARKO, LENT, TITLES.inLoans), place, TITLES)

    expect(loans.added).toEqual([{ loan: 'made-up-loan', day: LENT.day, kind: 'borrowed', amount: LENT.amount, note: '' }])
    const lent = CATEGORIES.find((held) => held.kind === 'informal-loan')!
    expect(store.state.workbook!.items.map((part) => [part.category, part.link?.kind])).toEqual([[lent.id, 'movement']])
    if (result.outcome !== 'linked') throw new Error(result.outcome)

    expect(await result.undo()).toEqual({ kept: false })
    expect(loans.undone).toBe(1)
    expect(store.state.workbook!.items).toEqual(wholeItems([paid]))
  })

  it('records an extra payment of the bank loan whose instalment is given, files the row whole under Loan principal linked to it, and one Undo takes back both', async () => {
    const { store, place, entry } = await fileWithPaid()
    const instalment: ShownTarget & InstalmentTarget = {
      kind: 'instalment',
      interim: false,
      link: { app: 'loans', kind: 'bank-loan', key: 'made-up-bank-loan', due: on('2026-11-15') },
      loanName: 'Car loan',
      lender: 'Example Bank',
      number: 14,
      count: 84,
      due: on('2026-11-15'),
      youPay: moneyFromAmount(250),
      interest: moneyFromAmount(50),
      principal: moneyFromAmount(200),
      to: { path: '/loans/bank-loan' },
    }
    const payment = { day: on('2026-11-20'), amount: moneyFromAmount(300), effect: 'lower-instalment' as const }
    const result = await addAndLink(store, entry, () => addLoansExtraPayment(instalment, payment, 'Extra payment added from Spending'), place, TITLES)

    expect(loans.added).toEqual([{ loan: 'made-up-bank-loan', ...payment }])
    const principal = CATEGORIES.find((held) => held.kind === 'repayment')!
    expect(store.state.workbook!.items.map((part) => [part.category, part.link?.kind])).toEqual([[principal.id, 'extra-payment']])
    if (result.outcome !== 'linked') throw new Error(result.outcome)
    expect(result.record).toMatchObject({ kind: 'extra-payment', loanName: 'Car loan', to: { path: '/loans/bank-loan' } })
    expect(await result.undo()).toEqual({ kept: false })
    expect(store.state.workbook!.items).toEqual(wholeItems([paid]))
  })

  it('writes nothing when Loans refuses the movement', async () => {
    const { store, place, entry } = await fileWithPaid()
    loans.refuse = 'Loans is not open.'
    const result = await addAndLink(store, entry, () => addLoansMovement(MARKO, LENT, TITLES.inLoans), place, TITLES)

    expect(result).toMatchObject({ outcome: 'not-added' })
    expect(store.state.writes).toEqual([])
  })

  it('keeps the movement in Loans when the link fails, with Undo for the movement alone', async () => {
    const { store, place } = await fileWithPaid()
    const gone = row(OTP, '2026-11-21', -300, 'Food/Groceries')
    const result = await addAndLink(store, gone, () => addLoansMovement(MARKO, LENT, TITLES.inLoans), place, TITLES)

    if (result.outcome !== 'not-linked') throw new Error(result.outcome)
    expect(loans.added).toHaveLength(1)
    await result.undoInLoans()
    expect(loans.undone).toBe(1)
  })

  it('takes the link off and says why the movement stays when Loans refuses its Undo', async () => {
    const { store, place, entry } = await fileWithPaid()
    const result = await addAndLink(store, entry, () => addLoansMovement(MARKO, LENT, TITLES.inLoans), place, TITLES)
    if (result.outcome !== 'linked') throw new Error(result.outcome)
    loans.refuseUndo = 'The movement was changed in Loans.'

    expect(await result.undo()).toMatchObject({ kept: true })
    expect(store.state.workbook!.items).toEqual(wholeItems([paid]))
  })
})
