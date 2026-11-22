// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { decodeDocument, encodeDocument } from '../src/shared/storage/infrastructure/documentFormat'

import { dryRunFor, statementReadings, writeImport } from '../src/apps/company/imports/application/importStatements'
import { passOverHeldStatement } from '../src/apps/company/imports/application/heldStatementWrites'
import { companyBooksOf } from '../src/apps/company/workbook/domain/readWorkbook'
import { LEDGER_WRITES } from '../src/apps/company/imports/application/ledgerWrites'
import { NOTHING_FILED, fileNewStatements, filedTitle } from '../src/apps/company/imports/application/statementSync'
import type { StatementSyncStep } from '../src/apps/company/imports/application/statementSync'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { moneyFromCents } from '../src/shared/money/money'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { LEDGER_HEADER, LEDGER_ROWS, browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { refusalText } from '../src/apps/company/imports/presentation/dryRunWords'
import { mailNeeds } from '../src/apps/company/mail/presentation/useMailSync'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { Account } from '../src/apps/company/workbook/domain/workbook'
import { emptyCompany } from './fixtures/emptyCompany'
import { civil } from './fixtures/ledger'

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
    // Each account takes its rows from the bank's statements from 1 June 2026, so the sync files them.
    accounts: [
      ['account', 'iban', 'rows_from', 'starts_on'],
      ['main', MAIN_IBAN, 'mail', 46174],
      ['savings', SAVINGS_IBAN, 'mail', 46174],
      ['reserve', RESERVE_IBAN, 'mail', 46174],
    ],
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

/** Files the statements of each camt text as a sync does once the mail step read them, each text as one mailed XML. */
async function syncOf(store: WorkbookStore<CompanyBooks, DocumentCopy>, texts: readonly string[], steps: StatementSyncStep[] = []) {
  const readings = await Promise.all(
    texts.map(async (text, index) => statementReadings(await loadImportFile(`IZV_${index}.xml`, new TextEncoder().encode(text).buffer as ArrayBuffer), store.state.workbook!, null)),
  )
  const mailed = readings.flatMap((read, index) =>
    read.map((reading) => ({ mailId: `mail-${index}`, mailedOn: civil('2026-10-08'), attachment: `IZV_${index}.xml`, label: 'statement' in reading ? reading.statement.label : reading.label })),
  )
  return fileNewStatements(readings.flat(), { store, mailed, step: (step) => steps.push(step) })
}

const MAIN_003 = camt(MAIN_IBAN, 3, '2026-10-06', 100_000, [{ reference: 'M3-1', cents: 10_000 }])
const MAIN_004 = camt(MAIN_IBAN, 4, '2026-10-07', 110_000, [
  { reference: 'M4-1', cents: -3_000 },
  { reference: 'M4-2', cents: 50_000 },
])

/** How many saves reached the Drive file. */
function writesTo(harness: WriteBackHarness): number {
  return harness.drive?.requests.filter((request) => request === 'upload').length ?? 0
}

/** The account's rows, newest booking first. */
function ledgerOf(store: WorkbookStore<CompanyBooks, DocumentCopy>, account: string): string[] {
  return store.state
    .workbook!.transactions.filter((row) => row.account === account)
    .sort((newer, older) => older.sequence - newer.sequence)
    .map((row) => `${row.date} ${row.reference} ${row.balance}`)
}

describe('the title of a filing write', () => {
  it('names one or two statements by number, and more by their count', () => {
    expect(filedTitle([{ label: '2026-10-06-statement-028' }], 1)).toBe('Filed statement 028, 1 row')
    expect(filedTitle([{ label: '2026-10-06-statement-028' }, { label: '2026-10-07-statement-029' }], 5)).toBe('Filed statements 028 and 029, 5 rows')
    expect(filedTitle([{ label: 'a' }, { label: 'b' }, { label: 'c' }], 9)).toBe('Filed 3 statements, 9 rows')
  })
})

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('filing the statements a sync read, on %s', (name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('files every accepted statement in one write, which one Undo takes out', async () => {
    const harness = await harnessOf(used, grids())
    const { store } = harness
    const before = ledgerOf(store, 'main')
    const steps: StatementSyncStep[] = []

    const outcome = await syncOf(store, [MAIN_003, MAIN_004], steps)

    expect(outcome.problem).toBeNull()
    expect(outcome.held).toEqual([])
    expect(outcome.filed.map((statement) => statement.label)).toEqual(['2026-10-06-statement-003', '2026-10-07-statement-004'])
    expect(steps).toEqual([{ kind: 'looking' }, { kind: 'filing', rows: 3 }])
    expect(store.state.writes).toHaveLength(1)
    expect(store.state.writes[0]?.receipt).toBe(outcome.receipt)
    expect(outcome.receipt?.title).toBe('Filed statements 003 and 004, 3 rows')
    if (name === 'a file on Drive') expect(writesTo(harness)).toBe(1)
    expect(ledgerOf(store, 'main').slice(0, 3)).toEqual(['2026-10-07 M4-2 157000', '2026-10-07 M4-1 107000', '2026-10-06 M3-1 110000'])

    await store.undo(store.state.writes[0]!)
    expect(ledgerOf(store, 'main')).toEqual(before)
  })

  it('holds a refused statement and every later one of its account, and still files another account', async () => {
    const { store } = await harnessOf(used, grids())
    const gap = camt(MAIN_IBAN, 3, '2026-10-06', 90_000, [{ reference: 'M3-1', cents: 10_000 }])
    const savings = camt(SAVINGS_IBAN, 2, '2026-10-06', 25_000, [{ reference: 'S2-1', cents: 1_000 }])
    const outcome = await syncOf(store, [gap, MAIN_004, savings])

    expect(outcome.filed.map((statement) => statement.label)).toEqual(['2026-10-06-statement-002'])
    expect(outcome.held.map((reading) => ('statement' in reading ? reading.statement.label : reading.label))).toEqual(['2026-10-06-statement-003', '2026-10-07-statement-004'])
    const held = dryRunFor(outcome.held, companyBooksOf(store.state)!, new Map(), new Map(), new Map(), true, 'automation').statements
    expect(held.map((statement) => statement.refusal && refusalText(statement.refusal))).toEqual([
      "The ledger ends main at €1,000.00 on 5 Oct 2026, but this statement's first new entry starts from €900.00, so a statement between the two is missing. Import that one first.",
      "The ledger ends main at €1,000.00 on 5 Oct 2026, but this statement's first new entry starts from €1,100.00, so a statement between the two is missing. Import that one first.",
    ])
    expect(ledgerOf(store, 'main')[0]).toBe('2026-10-05 REF-4 100000')
    expect(ledgerOf(store, 'savings')).toEqual(['2026-10-06 S2-1 26000', '2026-10-01 SAV-1 25000'])
    expect(store.state.writes).toHaveLength(1)
  })

  it("holds a statement of an account kept by hand, and one from before a mail account's start day, for the person", async () => {
    const seed = grids()
    const { store } = await harnessOf(used, {
      ...seed,
      accounts: [
        ['account', 'iban', 'rows_from', 'starts_on'],
        ['main', MAIN_IBAN, 'mail', 46302],
        ['savings', SAVINGS_IBAN, 'by-hand', ''],
        ['reserve', RESERVE_IBAN, 'mail', 46174],
      ],
    })
    const savings = camt(SAVINGS_IBAN, 2, '2026-10-06', 25_000, [{ reference: 'S2-1', cents: 1_000 }])
    const outcome = await syncOf(store, [MAIN_003, savings])

    expect(outcome.filed).toEqual([])
    const held = dryRunFor(outcome.held, companyBooksOf(store.state)!, new Map(), new Map(), new Map(), true, 'automation').statements
    expect(held.map((statement) => statement.refusal)).toEqual([
      { kind: 'before-start', account: 'main', startsOn: '2026-10-07', first: '2026-10-06' },
      { kind: 'other-source', account: 'savings', day: '2026-10-06', source: 'by-hand', origin: 'automation' },
    ])
    expect(store.state.writes.map((write) => write.receipt.title)).toEqual(['Kept the statements the sync holds until they are filed or passed over'])
    expect(store.state.workbook!.heldStatements.map((statement) => [statement.mailId, statement.label, statement.iban, statement.passedOverOn])).toEqual([
      ['mail-0', '2026-10-06-statement-003', MAIN_IBAN, null],
      ['mail-1', '2026-10-06-statement-002', SAVINGS_IBAN, null],
    ])
  })

  it('remembers a held statement once, so a later sync that holds it again writes nothing', async () => {
    const harness = await harnessOf(used, grids())
    const { store } = harness
    const reserve = camt(RESERVE_IBAN, 1, '2026-10-06', 5_000, [{ reference: 'R1-1', cents: 2_000 }])
    await syncOf(store, [reserve])
    const saves = writesTo(harness)

    const again = await syncOf(store, [reserve])

    expect(again.held).toHaveLength(1)
    expect(store.state.writes).toHaveLength(1)
    expect(writesTo(harness)).toBe(saves)
  })

  it('forgets a held statement in the write that files it, so one Undo brings both back', async () => {
    const { store } = await harnessOf(used, grids())
    const reserve = camt(RESERVE_IBAN, 1, '2026-10-06', 5_000, [{ reference: 'R1-1', cents: 2_000 }])
    const outcome = await syncOf(store, [reserve])
    const started = dryRunFor(outcome.held, companyBooksOf(store.state)!, new Map([['reserve', moneyFromCents(5_000)]]), new Map(), new Map(), true, 'automation')

    await store.write('Filed', (unit) => writeImport(unit, started, companyBooksOf(store.state)))

    expect(store.state.workbook!.heldStatements).toEqual([])
    expect(ledgerOf(store, 'reserve')).toEqual(['2026-10-06 R1-1 7000'])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.heldStatements.map((statement) => statement.label)).toEqual(['2026-10-06-statement-001'])
    expect(ledgerOf(store, 'reserve')).toEqual([])
  })

  it('holds a statement the person passed over no more, and writes nothing for it', async () => {
    const harness = await harnessOf(used, grids())
    const { store } = harness
    const reserve = camt(RESERVE_IBAN, 1, '2026-10-06', 5_000, [{ reference: 'R1-1', cents: 2_000 }])
    await syncOf(store, [reserve])
    const held = store.state.workbook!.heldStatements[0]!
    await store.write('Passed over', (unit) => passOverHeldStatement(unit, held, civil('2026-11-20')))
    const saves = writesTo(harness)

    const again = await syncOf(store, [reserve])

    expect(again.held).toEqual([])
    expect(store.state.workbook!.heldStatements.map((statement) => statement.passedOverOn)).toEqual(['2026-11-20'])
    expect(writesTo(harness)).toBe(saves)
  })

  it('writes nothing and adds nothing to the session when the mail held no statement', async () => {
    const harness = await harnessOf(used, grids())
    const { store } = harness
    const steps: StatementSyncStep[] = []

    expect(await syncOf(store, [], steps)).toEqual(NOTHING_FILED)
    expect(steps).toEqual([])
    expect(store.state.writes).toEqual([])
    if (name === 'a file on Drive') expect(writesTo(harness)).toBe(0)
  })

  it('adds the rows of a statement the bank mailed twice once, and a later sync that reads it again writes nothing', async () => {
    const harness = await harnessOf(used, grids())
    const { store } = harness

    const outcome = await syncOf(store, [MAIN_003, MAIN_003])

    expect(outcome.filed.map((statement) => statement.label)).toEqual(['2026-10-06-statement-003'])
    expect(ledgerOf(store, 'main').filter((row) => row.includes('M3-1'))).toEqual(['2026-10-06 M3-1 110000'])
    expect(await syncOf(store, [MAIN_003])).toEqual(NOTHING_FILED)
    expect(store.state.writes).toHaveLength(1)
  })

  it('holds the first statement of an account with no rows until it is started, then files it through the ledger writes', async () => {
    const { store } = await harnessOf(used, grids())
    const reserve = camt(RESERVE_IBAN, 1, '2026-10-06', 5_000, [{ reference: 'R1-1', cents: 2_000 }])
    const outcome = await syncOf(store, [reserve])

    expect(outcome.filed).toEqual([])
    expect(outcome.receipt).toBeNull()
    expect(store.state.workbook!.heldStatements.map((statement) => statement.label)).toEqual(['2026-10-06-statement-001'])
    const waiting = dryRunFor(outcome.held, companyBooksOf(store.state)!, new Map(), new Map(), new Map(), true, 'automation')
    expect(waiting.statements[0]).toMatchObject({ refusal: null, start: { account: 'reserve', opening: moneyFromCents(5_000), date: '2026-10-06' } })
    expect(waiting.newRows).toBe(0)

    const started = dryRunFor(outcome.held, companyBooksOf(store.state)!, new Map([['reserve', moneyFromCents(5_000)]]), new Map(), new Map(), true, 'automation')
    await store.write('Filed', (unit) => started.added.forEach((entry) => unit.of(LEDGER_WRITES).add(entry)))
    expect(ledgerOf(store, 'reserve')).toEqual(['2026-10-06 R1-1 7000'])
  })

  it('refuses a statement row whose reference a refused ledger row of the account holds, and writes nothing', async () => {
    const withRefused = grids()
    withRefused.ledger!.splice(1, 0, [46301, 'main', '2026-10-06-statement-003', 'Typed by hand', '', 'Half a row', 'abc', 1100, 'revenue', 'human', 'M3-1', '', '', '', '', '', '', ''])
    const { store } = await harnessOf(used, withRefused)
    expect(store.state.records?.ledger.refused.map((refused) => refused.reason)).toEqual(['the amount "abc" is not a number'])
    const before = ledgerOf(store, 'main')
    const outcome = await syncOf(store, [MAIN_003])

    expect(outcome.filed).toEqual([])
    expect(outcome.receipt).toBeNull()
    expect(outcome.problem).toBe('The ledger row "2026-10-06, Typed by hand, abc, balance 1100" is in the workbook already, so it is not added again.')
    expect(outcome.held.map((reading) => ('statement' in reading ? reading.statement.label : reading.label))).toEqual(['2026-10-06-statement-003'])
    expect(ledgerOf(store, 'main')).toEqual(before)
    expect(store.state.writes).toEqual([])
  })
})

describe("filing the statements a sync read against another device's sync", () => {
  it('reads the file again and runs the dry run once more when another device filed the same rows first, and writes nothing', async () => {
    const harness = await driveHarness(used, grids())
    const { store, drive } = harness
    const workbook = store.state.workbook!
    const run = dryRunFor(
      statementReadings({ kind: 'camt', fileName: 'x.xml', document: new DOMParser().parseFromString(MAIN_003, 'application/xml') }, workbook, null),
      companyBooksOf(store.state)!,
      new Map(),
      new Map(),
      new Map(),
      true,
      'automation',
    )
    const filedElsewhere = {
      date: '2026-10-06',
      account: 'main',
      statement: '2026-10-06-statement-003',
      description: 'Entry M3-1',
      amount: '100.00',
      balance: '1100.00',
      category: 'revenue',
      flagged_by: 'rule',
      reference: 'M3-1',
      tx_domain: 'PMNT',
      tx_family: 'RCDT',
      tx_sub_family: 'ESCT',
      id: 'another-device',
    }
    expect(run.added).toHaveLength(1)
    const fileId = store.state.choice!.id
    const held = decodeDocument(await drive!.download(fileId))
    await drive!.upload(fileId, encodeDocument({ ...held, records: { ...held.records, 'ledger-row': [...held.records['ledger-row']!, filedElsewhere] } }))
    drive!.requests.length = 0
    const steps: StatementSyncStep[] = []

    const outcome = await syncOf(store, [MAIN_003], steps)

    expect(outcome).toEqual(NOTHING_FILED)
    expect(steps).toEqual([{ kind: 'looking' }, { kind: 'filing', rows: 1 }, { kind: 'looking' }])
    expect(writesTo(harness)).toBe(0)
    expect(store.state.writes).toEqual([])
    expect(ledgerOf(store, 'main')).toContain('2026-10-06 M3-1 110000')
  })
})

describe('the statement mail step of a sync', () => {
  const BY_MAIL: Account = { slug: 'main', iban: MAIN_IBAN, currency: '', sources: [{ source: 'mail', from: civil('2026-11-01') }] }
  const BY_HAND_TOO: Account = { ...BY_MAIL, slug: 'savings', iban: SAVINGS_IBAN, sources: [{ source: 'by-hand', from: null }] }
  const named = emptyCompany({
    accounts: [BY_HAND_TOO],
    settings: { ...DEFAULT_SETTINGS, statementsMailFrom: ['statements@bank.example.com'], statementsMailSubject: 'Izvadak' },
  })

  it("asks Google for nothing while every account is kept by hand or no sender is named, and for Gmail read alone once one takes the bank's statements", () => {
    expect(mailNeeds(named)).toEqual([])

    const filling = { ...named, accounts: [BY_HAND_TOO, BY_MAIL] }
    expect(mailNeeds(filling).map((need) => need.scope)).toEqual(['gmail.readonly'])
    expect(mailNeeds({ ...filling, settings: { ...filling.settings, statementsMailFrom: [] } })).toEqual([])
  })

  it('asks Google for nothing while its switch is off, whatever the sender and the accounts say', () => {
    expect(mailNeeds({ ...named, accounts: [BY_MAIL], settings: { ...named.settings, statementsMail: false } })).toEqual([])
  })
})
