import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ACCOUNT_WRITES, changeAccount } from '../src/apps/spending/accounts/application/accountWrites'
import { sourceHandover } from '../src/apps/spending/accounts/domain/sourceHandover'
import { importGivingDays } from '../src/apps/spending/statements/application/statementWrites'
import { givenDays } from '../src/apps/spending/statements/domain/givenDays'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow } from '../src/apps/spending/statements/domain/statementRows'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { Account } from '../src/apps/spending/workbook/domain/account'
import type { Receipt } from '../src/apps/spending/workbook/domain/receipt'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { moneyFromAmount } from '../src/shared/money/money'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, FILE_THEN_LINK, addEntries, category, row } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

const BETWEEN = category('Between my accounts')
const FILED = row(FILE_THEN_LINK, '2026-10-13', -9, 'Food/Groceries', { payee: 'Market', source: 'statement', importKey: '0123456789abcdef-1' })
const TO_CASH = row(FILE_THEN_LINK, '2026-10-20', -50, 'Between my accounts', { payee: 'Cash machine', source: 'statement', importKey: '0123456789abcdef-2' })
const CASH_LEG = { ...row(CASH, '2026-10-20', 50, 'Between my accounts', { payee: 'Cash machine' }), pair: TO_CASH.id }
const RECEIPT: Receipt = {
  id: recordIdOf(RECEIPT_RECORDS, 'receipt-market'),
  transaction: FILED.id,
  account: null,
  merchant: 'Market',
  merchantOib: '',
  buyerOib: '',
  issuedOn: civil('2026-10-13'),
  issuedTime: '',
  total: moneyFromAmount(9),
  jir: '',
  zki: '',
  readBy: '',
  photo: '',
  latitude: '',
  longitude: '',
}

/** A file whose OTP takes the statement file's rows until the bank link takes over on 29 October, with a filed row that has a receipt and a cash withdrawal paired with its leg on cash. */
async function storeOf(): Promise<WorkbookStore<SpendingBooks>> {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, [FILE_THEN_LINK, ...ACCOUNTS.slice(1)]),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(TRANSACTION_RECORDS, [FILED, { ...TO_CASH, pair: CASH_LEG.id }, CASH_LEG]),
    ...stored(RECEIPT_RECORDS, [RECEIPT]),
  })
  const { store } = await browserHarness(used, document, SPENDING)
  return store
}

const LINKED_FROM_START: Account['sources'] = [{ source: 'bank-link', from: null }]

function otpOf(store: WorkbookStore<SpendingBooks>): Account {
  return store.state.workbook!.accounts.find((account) => account.id === FILE_THEN_LINK.id)!
}

async function handOver(store: WorkbookStore<SpendingBooks>, sources: Account['sources']) {
  const book = store.state.workbook!
  const before = otpOf(store)
  const handover = sourceHandover(book, before, sources)
  return { handover, receipt: await store.write('Saved', (unit) => changeAccount(unit, store.state.records!, before, { ...before, sources }, null, handover)) }
}

describe("giving an account's days to another source", () => {
  it('lists the rows the old source brought on the handed days, the receipt on one and the transfer whose other leg stays', async () => {
    const store = await storeOf()
    const handover = sourceHandover(store.state.workbook!, otpOf(store), LINKED_FROM_START)
    expect(handover?.runs).toEqual([{ from: null, to: civil('2026-10-28'), before: 'provider-file', after: 'bank-link' }])
    expect(handover?.rows.map((one) => one.payee)).toEqual(['Market', 'Cash machine'])
    expect(handover?.receipts.map((one) => one.id)).toEqual([RECEIPT.id])
    expect(handover?.loneLegs.map((one) => one.id)).toEqual([CASH_LEG.id])
  })

  it('refuses a change that leaves the old source rows on the days it gives away', async () => {
    const store = await storeOf()
    const before = otpOf(store)
    await expect(store.write('Saved', (unit) => unit.of(ACCOUNT_WRITES).change(before, { ...before, sources: LINKED_FROM_START }))).rejects.toThrow(
      '"OTP current" holds 2 rows on the days you give another source',
    )
  })

  it('carries those rows out in one write, the receipt waits again for the new row, the cash leg stays alone, and Undo puts it all back', async () => {
    const store = await storeOf()
    const { receipt } = await handOver(store, LINKED_FROM_START)
    const book = store.state.workbook!
    expect(otpOf(store).sources).toEqual(LINKED_FROM_START)
    expect(book.transactions.map((one) => [one.id, one.pair])).toEqual([[CASH_LEG.id, null]])
    expect(book.receipts).toMatchObject([{ id: RECEIPT.id, transaction: null, account: FILE_THEN_LINK.id }])
    expect(book.items.filter((item) => item.receipt === RECEIPT.id).map((item) => [item.transaction, item.amount])).toEqual([[null, accountMoneyFromAmount(-9)]])
    expect(book.problems).toEqual([])
    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    const back = store.state.workbook!
    expect(otpOf(store).sources).toEqual(FILE_THEN_LINK.sources)
    expect(back.transactions.map((one) => one.id).sort()).toEqual([FILED.id, TO_CASH.id, CASH_LEG.id].sort())
    expect(back.receipts).toMatchObject([{ id: RECEIPT.id, transaction: FILED.id }])
    expect(back.problems).toEqual([])
  })

  it('refuses Undo once the new source brought a row on the handed days, and says to move the edge back', async () => {
    const store = await storeOf()
    const { receipt } = await handOver(store, LINKED_FROM_START)
    const synced = row(FILE_THEN_LINK, '2026-10-14', -4, null, { source: 'statement', importKey: 'bank-otp-1', statement: 'Enable Banking' })
    await store.write('Synced', (unit) => addEntries(unit, store.state.records!, [synced]))
    await expect(store.undo(store.state.writes.find((write) => write.receipt === receipt)!)).rejects.toThrow('Move the edge back in the account dialog instead')
  })

  it("hands a typed transfer leg's day to the statement file, whose leg on the other account stays alone", async () => {
    const typedLeg = { ...row(FILE_THEN_LINK, '2026-11-02', -30, 'Between my accounts', { payee: 'To cash' }), pair: null }
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
      ...stored(ACCOUNT_RECORDS, [{ ...FILE_THEN_LINK, sources: [{ source: 'by-hand', from: null }] }, ...ACCOUNTS.slice(1)]),
      ...stored(CATEGORY_RECORDS, CATEGORIES),
      ...stored(TRANSACTION_RECORDS, [
        { ...typedLeg, pair: recordIdOf(TRANSACTION_RECORDS, 'cash-leg') },
        { ...row(CASH, '2026-11-02', 30, 'Between my accounts', { payee: 'From OTP' }), id: recordIdOf(TRANSACTION_RECORDS, 'cash-leg'), pair: typedLeg.id },
      ]),
    })
    const { store } = await browserHarness(used, document, SPENDING)
    await handOver(store, [{ source: 'provider-file', from: null }])
    expect(store.state.workbook!.transactions.map((one) => [one.account, one.pair])).toEqual([[CASH.id, null]])
    expect(store.state.workbook!.items.find((item) => item.transaction === recordIdOf(TRANSACTION_RECORDS, 'cash-leg'))?.category).toBe(BETWEEN.id)
  })
})

describe('the days a lapsed bank link missed, given to the statement file on Import', () => {
  const fileRow = (date: string, amount: number, payee: string, key: string): StatementRow => ({
    account: FILE_THEN_LINK.id,
    date: civil(date),
    amount: accountMoneyFromAmount(amount),
    payee,
    category: null,
    description: '',
    counterpartyIban: '',
    importKey: key,
    movedAt: '',
    pocket: false,
    cashWithdrawal: false,
    pending: false,
  })

  it('come in with the import in one write, the sync rows on them go, and one Undo takes both back', async () => {
    const synced = row(FILE_THEN_LINK, '2026-11-02', -4, null, { payee: 'Kiosk', source: 'statement', importKey: 'bank-otp-1', statement: 'Enable Banking' })
    const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
      ...stored(ACCOUNT_RECORDS, [FILE_THEN_LINK, ...ACCOUNTS.slice(1)]),
      ...stored(CATEGORY_RECORDS, CATEGORIES),
      ...stored(TRANSACTION_RECORDS, [synced]),
    })
    const { store } = await browserHarness(used, document, SPENDING)
    const statement = { label: 'export.csv', fileNotes: [], rows: [fileRow('2026-11-01', -12, 'Bakery', 'f-1'), fileRow('2026-11-03', -20, 'Pharmacy', 'f-2')] }
    const first = statementDryRun(store.state.workbook!, statement, civil('2026-11-04'))
    const [left] = first.leftOut
    expect(left).toMatchObject({ kind: 'not-taken', count: 2, source: 'bank-link', days: { from: civil('2026-11-01'), to: civil('2026-11-03') } })
    if (left?.kind !== 'not-taken') throw new Error('nothing left out')
    const given = givenDays(store.state.workbook!, left)!
    expect(given.handover?.rows.map((one) => one.payee)).toEqual(['Kiosk'])
    const run = statementDryRun(
      { ...store.state.workbook!, accounts: store.state.workbook!.accounts.map((one) => (one.id === given.account.id ? { ...one, sources: given.sources } : one)), transactions: [] },
      statement,
      civil('2026-11-04'),
    )
    const receipt = await store.write('Imported', (unit) => importGivingDays(unit, store.state.records!, [given], run))
    expect(otpOf(store).sources).toEqual([...FILE_THEN_LINK.sources, { source: 'provider-file', from: civil('2026-11-01') }, { source: 'bank-link', from: civil('2026-11-04') }])
    expect(store.state.workbook!.transactions.map((one) => one.payee).sort()).toEqual(['Bakery', 'Pharmacy'])
    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    expect(otpOf(store).sources).toEqual(FILE_THEN_LINK.sources)
    expect(store.state.workbook!.transactions.map((one) => one.payee)).toEqual(['Kiosk'])
  })
})
