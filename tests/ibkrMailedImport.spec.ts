// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { words as refusalWords } from '../src/apps/investments/holdings/application/words'
import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { writeWorkbookImport } from '../src/apps/investments/imports/application/workbookImport'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import type { WorkbookAnswers, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { importableRecords } from '../src/apps/investments/imports/domain/importedRecords'
import { matchedWithKey } from '../src/apps/investments/imports/domain/importKeys'
import { heldOrNewReader, writeReader } from '../src/apps/investments/mail/application/mailReaderWrites'
import { importMailedReport, syncImports } from '../src/apps/investments/mail/application/reportImport'
import type { MailedImportPorts } from '../src/apps/investments/mail/application/reportImport'
import { IBKR_FLEX_RECIPE, ibkrMailReader } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { reportRows } from '../src/apps/investments/mail/domain/reportRows'
import { sampleFlexReport } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import { writeTransaction } from '../src/apps/investments/transactions/application/transactionWrites'
import { transactionCount } from '../src/apps/investments/transactions/domain/listedTransactions'
import { BY_HAND_SOURCES } from '../src/apps/investments/workbook/domain/investmentAccount'
import type { InvestmentsBooks } from '../src/apps/investments/workbook/domain/investmentsBooks'
import { emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { NO_RATES } from '../src/shared/money/rateBook'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { CASH_MOVEMENT_RECORDS, TRADE_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import { USD, account, book, cashMovement, instrument, rateBookOf, trade } from './fixtures/investments'
import { INVESTMENTS, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const DAY = parseCivilDate('2026-10-05')!
const NEXT_DAY = parseCivilDate('2026-10-06')!
const START = parseCivilDate('2026-06-01')!
const ACCOUNT = account('kuna-ibkr', 'Kuna IBKR', [...BY_HAND_SOURCES, { source: 'mail', from: START }])
const ABC = instrument('abc', { name: 'Example Tech', isin: 'XX000000ABC1', currency: USD })
const DEF = instrument('def', { name: 'Example Dividend Co', isin: 'US000000DEF2', currency: USD })
const RATES = rateBookOf(new Map([[USD, [['2026-10-01', '1.10']]]]))
const ANSWERS: WorkbookAnswers = {
  ...NO_ANSWERS,
  accounts: new Map([['U0000001', ACCOUNT]]),
  instruments: new Map([
    ['XX000000ABC1', ABC],
    ['US000000DEF2', DEF],
  ]),
}

function rowsOf(days: readonly CivilDate[]): WorkbookRows {
  const read = readRecipeFile(IBKR_FLEX_RECIPE, new TextEncoder().encode(sampleFlexReport(days)).buffer as ArrayBuffer)
  if (read.kind !== 'read') throw new Error('It did not read.')
  const run = runRecipe(IBKR_FLEX_RECIPE, read.rows)
  if (run.kind !== 'read') throw new Error('It does not fit.')
  return reportRows(IBKR_FLEX_RECIPE, [{ fileName: 'report.xml', run }], { leftOut: [] }, { kind: 'mailed', since: START })
}

/** A file whose account and holdings an import of the first day's report wrote to, with IBKR's reader on. */
async function storeAfterFirstDay(): Promise<WorkbookStore<InvestmentsBooks>> {
  const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
  await store.write('Set up', (unit) => {
    unit.of(INVESTMENT_ACCOUNT_WRITES).add(ACCOUNT)
    ;[ABC, DEF].forEach((added) => unit.of(INSTRUMENT_WRITES).add(added))
    writeTransaction(unit, null, { kind: 'trade', record: trade('buy', ACCOUNT, ABC, '2026-01-05', '10', '90', '1', '1.1') })
    writeReader(unit, store.state.workbook!.book, null, { ...heldOrNewReader(null), on: true })
  })
  const first = workbookDryRun(rowsOf([DAY]), { book: store.state.workbook!.book, rates: RATES, answers: ANSWERS })
  await store.write('First day', (unit) => writeWorkbookImport(unit, first.added, [], []))
  return store
}

function portsOf(store: WorkbookStore<InvestmentsBooks>, overrides: Partial<MailedImportPorts> = {}): MailedImportPorts {
  return {
    store,
    reading: rowsOf([DAY, NEXT_DAY]),
    reader: ibkrMailReader(store.state.workbook!.book)!,
    misfit: false,
    undone: new Set(),
    rates: () => RATES,
    fetchRates: async () => null,
    title: (records) => `Imported ${records} records`,
    ...overrides,
  }
}

describe("a sync's import of a mailed report", () => {
  it("writes the report's new rows once, in one write that Undo takes back whole", async () => {
    const store = await storeAfterFirstDay()
    const before = transactionCount(store.state.workbook!.book)
    const outcome = await importMailedReport(portsOf(store))
    expect(outcome).toMatchObject({ kind: 'imported', records: 10 })
    expect(transactionCount(store.state.workbook!.book)).toBe(before + 10)
    expect(store.state.writes[0]?.receipt).toBe(outcome.kind === 'imported' ? outcome.receipt : null)

    expect(await importMailedReport(portsOf(store))).toEqual({ kind: 'nothing' })
    expect(store.state.writes).toHaveLength(3)

    await store.undo(store.state.writes[0]!)
    expect(transactionCount(store.state.workbook!.book)).toBe(before)
  })

  it('does not import again the rows Undo took back, so they wait for the person', async () => {
    const store = await storeAfterFirstDay()
    const imports = syncImports()
    const first = await importMailedReport(portsOf(store, { undone: imports.undone(store.state.writes) }))
    imports.add(first)
    const write = store.state.writes.find((written) => first.kind === 'imported' && written.receipt === first.receipt)!
    await store.undo(write)

    const again = await importMailedReport(portsOf(store, { undone: imports.undone(store.state.writes) }))
    expect(again).toEqual({ kind: 'waits', waits: [{ kind: 'undone' }] })
  })

  it('fetches the ECB rates the rows lack once, and waits when they are still missing', async () => {
    const store = await storeAfterFirstDay()
    const fetchRates = vi.fn(async () => null)
    const outcome = await importMailedReport(portsOf(store, { rates: () => NO_RATES, fetchRates }))
    expect(fetchRates).toHaveBeenCalledTimes(1)
    expect(outcome.kind === 'waits' && outcome.waits).toContainEqual({ kind: 'rates', currencies: ['USD'] })
  })

  it('writes nothing while a file of the mail does not fit', async () => {
    const store = await storeAfterFirstDay()
    const writes = store.state.writes.length
    expect(await importMailedReport(portsOf(store, { misfit: true }))).toEqual({ kind: 'waits', waits: [{ kind: 'misfit' }] })
    expect(store.state.writes).toHaveLength(writes)
  })

  it('says why when another device imported the same rows first', async () => {
    const store = await storeAfterFirstDay()
    const elsewhere = workbookDryRun(rowsOf([DAY, NEXT_DAY]), { book: store.state.workbook!.book, rates: RATES, answers: ANSWERS })
    const racing: MailedImportPorts['store'] = {
      state: store.state,
      async write(title, work) {
        await store.write('On another device', (unit) => writeWorkbookImport(unit, elsewhere.added, [], []))
        return store.write(title, work)
      },
    }
    const outcome = await importMailedReport(portsOf(store, { store: racing }))
    expect(outcome).toEqual({ kind: 'refused', reason: refusalWords.importKeyHeld })
  })
})

describe('an import key held by a second record', () => {
  it('refuses an import that books rows of the file a second time, as an Accept on an older copy would', async () => {
    const store = await storeAfterFirstDay()
    const again = workbookDryRun(rowsOf([DAY]), {
      book: book({ accounts: [ACCOUNT], instruments: [ABC, DEF], trades: [trade('buy', ACCOUNT, ABC, '2026-01-05', '10', '90', '1', '1.1')] }),
      rates: RATES,
      answers: ANSWERS,
    })
    const fresh = importableRecords(again.added).filter((imported) => imported.kind === 'cash-movement')
    await expect(store.write('Again', (unit) => fresh.forEach((imported) => writeTransaction(unit, null, imported)))).rejects.toThrow(refusalWords.importKeyHeld)
  })

  it('refuses a record matched to a row whose key another record holds', async () => {
    const store = await storeAfterFirstDay()
    const held = store.state.workbook!.book.cashMovements.find((movement) => movement.importKeys.length > 0)!
    const typed = { ...cashMovement('deposit', ACCOUNT, '2026-02-01', '10'), id: recordIdOf(CASH_MOVEMENT_RECORDS, 'typed') }
    await store.write('Typed', (unit) => writeTransaction(unit, null, { kind: 'cash-movement', record: typed }))
    const keyed = matchedWithKey({ kind: 'cash-movement', record: typed }, held.importKeys[0]!)
    await expect(store.write('Matched', (unit) => writeWorkbookImport(unit, book({}), [{ kept: { kind: 'cash-movement', record: typed }, keyed }], []))).rejects.toThrow(refusalWords.importKeyHeld)
  })

  it('refuses a row of a question booked a second time, from the dialog or the chat', async () => {
    const store = await storeAfterFirstDay()
    const booked = { ...trade('buy', ACCOUNT, ABC, '2026-07-02', '1', '90', '1', '1.1'), importKeys: ['ibkr-activity-flex:asked:question-1'] }
    await store.write('Booked', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...booked, id: recordIdOf(TRADE_RECORDS, 'booked-1') } }))
    await expect(store.write('Booked again', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...booked, id: recordIdOf(TRADE_RECORDS, 'booked-2') } }))).rejects.toThrow(
      refusalWords.importKeyHeld,
    )
  })

  it('lets a record that holds a key be changed, keeping its key', async () => {
    const store = await storeAfterFirstDay()
    const held = store.state.workbook!.book.cashMovements.find((movement) => movement.importKeys.length > 0)!
    await store.write('Note', (unit) => writeTransaction(unit, { kind: 'cash-movement', record: held }, { kind: 'cash-movement', record: { ...held, note: 'Checked' } }))
    expect(store.state.workbook!.book.cashMovements.find((movement) => movement.id === held.id)?.note).toBe('Checked')
  })
})
