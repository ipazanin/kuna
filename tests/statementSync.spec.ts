// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { dryRunFor, statementReadings } from '../src/features/imports/application/importStatements'
import { LEDGER_WRITES } from '../src/features/imports/application/ledgerWrites'
import type { StatementFolder } from '../src/features/imports/application/statementFolder'
import { NOTHING_FILED, fileNewStatements, filedTitle } from '../src/features/imports/application/statementSync'
import type { StatementSyncStep } from '../src/features/imports/application/statementSync'
import { loadImportFile } from '../src/features/imports/infrastructure/importFiles'
import { moneyFromCents } from '../src/shared/money/money'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import type { WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { LEDGER_HEADER, LEDGER_ROWS, excelHarness, forgetCaches, googleHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const MAIN_IBAN = 'XX00FAKE0000000001'
const SAVINGS_IBAN = 'XX00FAKE0000000000000020'
const RESERVE_IBAN = 'XX00FAKE0000000000000021'

/** The harness's ledger with statement labels as the camt reader names them, and a savings account with one row. */
function grids(): Record<string, CellValue[][]> {
  const labels: Record<string, string> = { 's-001': '2026-10-03-statement-001', 's-002': '2026-10-05-statement-002' }
  return {
    ...workbookGrids(),
    ledger: [
      LEDGER_HEADER,
      ...LEDGER_ROWS.map((row) => row.map((cell, column) => (column === 2 ? labels[String(cell)]! : cell))),
      [46296, 'savings', '2026-10-01-statement-001', 'Opening deposit', '', 'Deposit', 250, 250, 'revenue', 'rule', 'SAV-1', '', '', '', '', '', '', ''],
    ],
    accounts: [['account', 'iban'], ['main', MAIN_IBAN], ['savings', SAVINGS_IBAN], ['reserve', RESERVE_IBAN]],
  }
}

/** A camt.053 statement made on `day` and booked that day, its entries signed in cents, credits positive. */
function camt(iban: string, sequence: number, day: string, openingCents: number, entries: readonly { readonly reference: string; readonly cents: number }[]): string {
  const money = (cents: number): string => (Math.abs(cents) / 100).toFixed(2)
  const credits = entries.filter((entry) => entry.cents > 0)
  const debits = entries.filter((entry) => entry.cents < 0)
  const sum = (side: typeof entries): number => side.reduce((total, entry) => total + Math.abs(entry.cents), 0)
  const closing = openingCents + entries.reduce((total, entry) => total + entry.cents, 0)
  const entryXml = (entry: (typeof entries)[number]): string => `
      <Ntry>
        <NtryRef>${entry.reference}</NtryRef>
        <Amt Ccy="EUR">${money(entry.cents)}</Amt>
        <CdtDbtInd>${entry.cents > 0 ? 'CRDT' : 'DBIT'}</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>${day}</Dt></BookgDt>
        <AcctSvcrRef>${entry.reference}</AcctSvcrRef>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <AddtlNtryInf>Entry ${entry.reference}</AddtlNtryInf>
      </Ntry>`
  return `<?xml version="1.0" encoding="utf-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>TEST-${sequence}</MsgId><CreDtTm>${day}T06:00:00</CreDtTm></GrpHdr>
    <Stmt>
      <LglSeqNb>${sequence}</LglSeqNb>
      <CreDtTm>${day}T06:00:00</CreDtTm>
      <Acct><Id><IBAN>${iban}</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${money(openingCents)}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>${day}</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${money(closing)}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>${day}</Dt></Dt></Bal>
      <TxsSummry>
        <TtlCdtNtries><NbOfNtries>${credits.length}</NbOfNtries><Sum>${money(sum(credits))}</Sum></TtlCdtNtries>
        <TtlDbtNtries><NbOfNtries>${debits.length}</NbOfNtries><Sum>${money(sum(debits))}</Sum></TtlDbtNtries>
      </TxsSummry>${entries.map(entryXml).join('')}
    </Stmt>
  </BkToCstmrStmt>
</Document>
`
}

/** A statements folder at the default path, holding each file's text, or only its name for a statement Drive holds but no test downloads. */
function folderHolding(files: Readonly<Record<string, string | null>>): { readonly folder: StatementFolder; readonly downloads: string[] } {
  const downloads: string[] = []
  const folder: StatementFolder = {
    async files() {
      return { kind: 'listed', files: Object.keys(files).map((name) => ({ id: name, name })) }
    },
    async download(file) {
      downloads.push(file.name)
      const text = files[file.name]
      if (text === null || text === undefined) throw new Error(`${file.name} was downloaded, though the ledger holds it.`)
      return new TextEncoder().encode(text).buffer as ArrayBuffer
    },
  }
  return { folder, downloads }
}

function syncOf(store: WorkbookStore<WorkbookSnapshot>, folder: StatementFolder, steps: StatementSyncStep[] = []) {
  return fileNewStatements({ store, folder, load: loadImportFile, step: (step) => steps.push(step) })
}

const MAIN_003 = camt(MAIN_IBAN, 3, '2026-10-06', 100_000, [{ reference: 'M3-1', cents: 10_000 }])
const MAIN_004 = camt(MAIN_IBAN, 4, '2026-10-07', 110_000, [
  { reference: 'M4-1', cents: -3_000 },
  { reference: 'M4-2', cents: 50_000 },
])

function writesTo(harness: WriteBackHarness): number {
  return harness.sheets.requests.filter((request) => request.kind === 'updateSpreadsheet').length
}

function ledgerOf(store: WorkbookStore<WorkbookSnapshot>, account: string): string[] {
  return store.state.workbook!.transactions.filter((row) => row.account === account).map((row) => `${row.date} ${row.reference} ${row.balance}`)
}

describe('the title of a filing write', () => {
  it('names one or two statements by number, and more by their count', () => {
    expect(filedTitle([{ label: '2026-10-06-statement-028' }], 1)).toBe('Filed statement 028, 1 row')
    expect(filedTitle([{ label: '2026-10-06-statement-028' }, { label: '2026-10-07-statement-029' }], 5)).toBe('Filed statements 028 and 029, 5 rows')
    expect(filedTitle([{ label: 'a' }, { label: 'b' }, { label: 'c' }], 9)).toBe('Filed 3 statements, 9 rows')
  })
})

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('the statements step of a sync, on %s', (name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('files every accepted statement in one write, which one Undo takes out', async () => {
    const harness = await harnessOf(used, grids())
    const { store } = harness
    const before = ledgerOf(store, 'main')
    const { folder } = folderHolding({ '2026-10-06-statement-003-main.xml': MAIN_003, '2026-10-06-statement-003.pdf': null, '2026-10-07-statement-004-main.xml': MAIN_004 })
    const steps: StatementSyncStep[] = []

    const outcome = await syncOf(store, folder, steps)

    expect(outcome.problem).toBeNull()
    expect(outcome.held).toEqual([])
    expect(outcome.filed.map((statement) => statement.label)).toEqual(['2026-10-06-statement-003', '2026-10-07-statement-004'])
    expect(steps).toEqual([{ kind: 'looking' }, { kind: 'filing', rows: 3 }])
    expect(store.state.writes).toHaveLength(1)
    expect(store.state.writes[0]?.receipt).toBe(outcome.receipt)
    expect(outcome.receipt?.title).toBe('Filed statements 003 and 004, 3 rows')
    if (name === 'a Google Sheet') expect(writesTo(harness)).toBe(1)
    expect(ledgerOf(store, 'main').slice(0, 3)).toEqual(['2026-10-07 M4-2 157000', '2026-10-07 M4-1 107000', '2026-10-06 M3-1 110000'])

    await store.undo(store.state.writes[0]!)
    expect(ledgerOf(store, 'main')).toEqual(before)
  })

  it('holds a refused statement and every later one of its account, and still files another account', async () => {
    const { store } = await harnessOf(used, grids())
    const gap = camt(MAIN_IBAN, 3, '2026-10-06', 90_000, [{ reference: 'M3-1', cents: 10_000 }])
    const savings = camt(SAVINGS_IBAN, 2, '2026-10-06', 25_000, [{ reference: 'S2-1', cents: 1_000 }])
    const { folder } = folderHolding({ '2026-10-06-statement-003-main.xml': gap, '2026-10-07-statement-004-main.xml': MAIN_004, '2026-10-06-statement-002-savings.xml': savings })

    const outcome = await syncOf(store, folder)

    expect(outcome.filed.map((statement) => statement.label)).toEqual(['2026-10-06-statement-002'])
    expect(outcome.held.map((reading) => ('statement' in reading ? reading.statement.label : reading.label))).toEqual(['2026-10-06-statement-003', '2026-10-07-statement-004'])
    const held = dryRunFor(outcome.held, store.state.workbook!, new Map()).statements
    expect(held.map((statement) => statement.refusal)).toEqual([
      "The ledger ends main at 1000.00 on 2026-10-05, but this statement's first new entry starts from 900.00, so a statement between the two is missing. Import that one first.",
      "The ledger ends main at 1000.00 on 2026-10-05, but this statement's first new entry starts from 1100.00, so a statement between the two is missing. Import that one first.",
    ])
    expect(ledgerOf(store, 'main')[0]).toBe('2026-10-05 REF-4 100000')
    expect(ledgerOf(store, 'savings')).toEqual(['2026-10-06 S2-1 26000', '2026-10-01 SAV-1 25000'])
    expect(store.state.writes).toHaveLength(1)
  })

  it('downloads nothing, writes nothing and adds nothing to the session when every file is on the ledger by its name', async () => {
    const harness = await harnessOf(used, grids())
    const { store } = harness
    const { folder, downloads } = folderHolding({
      '2026-10-03-statement-001-main.xml': null,
      '2026-10-03-statement-001.pdf': null,
      '2026-10-05-statement-002-main.xml': null,
      '2026-10-01-statement-001-savings.xml': null,
    })
    const steps: StatementSyncStep[] = []

    expect(await syncOf(store, folder, steps)).toEqual(NOTHING_FILED)
    expect(downloads).toEqual([])
    expect(steps).toEqual([{ kind: 'looking' }])
    expect(store.state.writes).toEqual([])
    if (name === 'a Google Sheet') expect(writesTo(harness)).toBe(0)
  })

  it('holds the first statement of an account with no rows until it is started, then files it through the ledger writes', async () => {
    const { store } = await harnessOf(used, grids())
    const reserve = camt(RESERVE_IBAN, 1, '2026-10-06', 5_000, [{ reference: 'R1-1', cents: 2_000 }])
    const { folder } = folderHolding({ '2026-10-06-statement-001-reserve.xml': reserve })

    const outcome = await syncOf(store, folder)

    expect(outcome.filed).toEqual([])
    expect(outcome.receipt).toBeNull()
    expect(store.state.writes).toEqual([])
    const waiting = dryRunFor(outcome.held, store.state.workbook!, new Map())
    expect(waiting.statements[0]).toMatchObject({ refusal: null, start: { account: 'reserve', opening: moneyFromCents(5_000), date: '2026-10-06' } })
    expect(waiting.newRows).toBe(0)

    const started = dryRunFor(outcome.held, store.state.workbook!, new Map([['reserve', moneyFromCents(5_000)]]))
    await store.write('Filed', (unit) => started.added.forEach((entry) => unit.of(LEDGER_WRITES).add(entry)))
    expect(ledgerOf(store, 'reserve')).toEqual(['2026-10-06 R1-1 7000'])
  })

  it('reads a file that does not parse as a held statement with the reason', async () => {
    const { store } = await harnessOf(used, grids())
    const { folder } = folderHolding({ 'stray.xml': '<Document><nothing' })

    const outcome = await syncOf(store, folder)

    expect(outcome.held).toEqual([{ fileName: 'stray.xml', label: 'stray.xml', refusal: 'stray.xml is not well-formed XML, so it cannot be read as a camt.053 statement.' }])
    expect(store.state.writes).toEqual([])
  })

  it('refuses a statement row whose reference a refused ledger row of the account holds, and writes nothing', async () => {
    const withRefused = grids()
    withRefused.ledger!.splice(1, 0, [46301, 'main', '2026-10-06-statement-003', 'Typed by hand', '', 'Half a row', 'abc', 1100, 'revenue', 'human', 'M3-1', '', '', '', '', '', '', ''])
    const { store } = await harnessOf(used, withRefused)
    expect(store.state.records?.ledger.refused.map((refused) => refused.reason)).toEqual(['the amount "abc" is not a number'])
    const before = ledgerOf(store, 'main')
    const { folder } = folderHolding({ 'main-003.xml': MAIN_003 })

    const outcome = await syncOf(store, folder)

    expect(outcome.filed).toEqual([])
    expect(outcome.receipt).toBeNull()
    expect(outcome.problem).toBe('Nothing was written. The ledger row "2026-10-06, Typed by hand, abc, balance 1100" is in the workbook already, so it is not added again.')
    expect(outcome.held.map((reading) => ('statement' in reading ? reading.statement.label : reading.label))).toEqual(['2026-10-06-statement-003'])
    expect(ledgerOf(store, 'main')).toEqual(before)
    expect(store.state.writes).toEqual([])
  })
})

describe('the statements step against another device\'s sync', () => {
  it('reads the Sheet again and runs the dry run once more when another device filed the same rows first, and writes nothing', async () => {
    const harness = await googleHarness(used, grids())
    const { store, sheets } = harness
    const workbook = store.state.workbook!
    const run = dryRunFor(statementReadings({ kind: 'camt', fileName: 'x.xml', document: new DOMParser().parseFromString(MAIN_003, 'application/xml') }, workbook, null), workbook, new Map())
    const filedElsewhere = [46301, 'main', '2026-10-06-statement-003', '', '', 'Entry M3-1', 100, 1100, 'revenue', 'rule', 'M3-1', '', 'PMNT', 'RCDT', 'ESCT', '', '', '']
    expect(run.added).toHaveLength(1)
    sheets.grids.ledger!.splice(1, 0, filedElsewhere)
    const { folder } = folderHolding({ '2026-10-06-statement-003-main.xml': MAIN_003 })
    const steps: StatementSyncStep[] = []

    const outcome = await syncOf(store, folder, steps)

    expect(outcome).toEqual(NOTHING_FILED)
    expect(steps).toEqual([{ kind: 'looking' }, { kind: 'filing', rows: 1 }, { kind: 'looking' }])
    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toEqual([])
    expect(store.state.writes).toEqual([])
    expect(ledgerOf(store, 'main')[0]).toBe('2026-10-06 M3-1 110000')
  })
})
