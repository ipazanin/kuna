// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { readAttachment } from '../src/shared/ai/application/attachmentReads'
import { attachedFile } from '../src/shared/ai/application/chatFiles'
import type { ChatReads } from '../src/shared/ai/application/chatReads'
import type { ChatAttachment } from '../src/shared/ai/domain/chatAttachments'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'
import { parseCivilDate, serialFromCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromCents } from '../src/shared/money/money'
import { sheetJs } from '../src/shared/xlsx/sheetGrids'
import { dryRunFor, statementReadings } from '../src/apps/company/imports/application/importStatements'
import { fileShapeOf } from '../src/apps/company/imports/domain/profileGuess'
import { statementFilesToRead } from '../src/apps/company/imports/domain/statementFiles'
import { readTabularStatement } from '../src/apps/company/imports/domain/tabularStatement'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'

/**
 * Files shaped like the exports Croatian banks give, every name, IBAN and amount invented: the banks' shared camt.053.001.02 guide,
 * an MT940 of the Halcom e-banking that several banks use, an OFX 1.0.2 file and a statement sheet with typed day and amount cells.
 */
const EXPORTS = join(import.meta.dirname, 'fixtures', 'bank-exports')
const CAMT = 'BCS.00000000000.20311103.0001.xml'
const MT940 = 'izvod-41.sta'
const OFX = 'promet.ofx'

const ACCOUNT_IBAN = 'HR4599999991000000017'
const PAYER_IBAN = 'HR2399999991000000025'
const TELECOM_IBAN = 'HR9899999991000000033'

const workbook = readSnapshot(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z')).workbook

function bytesOf(name: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(join(EXPORTS, name)))
}

function readsOf(): ChatReads {
  return { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: () => false }
}

async function attached(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<ChatAttachment> {
  const file = await attachedFile(new File([bytes], name), 'a1', 0, () => Promise.reject(new Error('no photos here')))
  if ('reason' in file) throw new Error(`refused: ${file.reason}`)
  return file
}

/** Every sheet of a file as the chat sends it to the model, one read a sheet. */
async function sentSheets(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<readonly (readonly (readonly string[])[])[]> {
  const file = await attached(name, bytes)
  const count = file.reading.kind === 'cells' ? file.reading.sheets.length : 0
  return Promise.all(
    Array.from({ length: count }, async (_, at) => {
      const answer = await readAttachment({ attachment: file.id, pages: null, sheet: at + 1, rows: null }, [file], true, readsOf())
      if (answer.isError) throw new Error(answer.text)
      return (JSON.parse(answer.text) as { readonly rows: readonly (readonly string[])[] }).rows
    }),
  )
}

/** The rows of a file's first sheet as the chat sends them to the model. */
async function sentRows(name: string, bytes: Uint8Array<ArrayBuffer>): Promise<readonly (readonly string[])[]> {
  return (await sentSheets(name, bytes))[0] ?? []
}

describe("a camt.053.001.02 statement in the Croatian banks' shape", () => {
  it('is read from the statements folder by its BCS name, which carries no label of its own', () => {
    expect(statementFilesToRead([{ id: 'f1', name: CAMT }], workbook.transactions).map((file) => file.name)).toEqual([CAMT])
  })

  it('imports its booked entries, with codes and totals that end in a space trimmed, a counted batch and an upper-case reversal flagged, and the pending entry left out', async () => {
    const loaded = await loadImportFile(CAMT, bytesOf(CAMT).buffer)
    const readings = statementReadings(loaded, workbook, null)

    expect(readings).toHaveLength(1)
    expect(readings[0]).toMatchObject({ newAccount: { iban: ACCOUNT_IBAN, currency: 'EUR' } })
    const run = dryRunFor(readings, workbook, new Map(), new Map([[ACCOUNT_IBAN, 'primjer']]))
    const [statement] = run.statements
    expect(statement?.refusal).toBeNull()
    expect(statement?.notes).toEqual(['1 entry the bank has not booked yet, such as a pending one, is left out, since it has not moved the balance.'])
    expect(statement?.label).toBe('2031-11-03-statement-041')
    expect(statement?.rows.map((row) => [row.date, row.amount, row.balance, row.counterparty, row.counterpartyIban, row.reviewReasons])).toEqual([
      ['2031-11-02', moneyFromCents(50_000), moneyFromCents(150_000), 'Primjer Trgovina d.o.o.', PAYER_IBAN, []],
      ['2031-11-02', moneyFromCents(-40_000), moneyFromCents(110_000), 'Razni korisnici', '', ['batched entry']],
      ['2031-11-02', moneyFromCents(-3_550), moneyFromCents(106_450), 'Telekom Primjer d.d.', TELECOM_IBAN, []],
      ['2031-11-02', moneyFromCents(1_200), moneyFromCents(107_650), 'KAVANA PRIMJER', '', ['reversal']],
    ])
    expect(statement?.rows[0]).toMatchObject({ reference: 'REF-0001', description: 'Plaćanje računa 12-1-2031', signals: { txDomain: 'PMNT', txFamily: 'RCDT', purpose: 'OTHR' } })
    expect(statement?.rows[2]?.signals).toMatchObject({ creditorReference: 'HR01 123456-2031', txDomain: '' })
    expect(run).toMatchObject({ newRows: 4, accounts: [{ slug: 'primjer', iban: ACCOUNT_IBAN, currency: 'EUR' }] })
  })

  it('goes to the model as rows of cells with every IBAN under a token and the amounts as written', async () => {
    const sent = JSON.stringify(await sentSheets(CAMT, bytesOf(CAMT)))

    expect(sent).toContain('1076.50')
    expect(sent).toContain('Plaćanje računa 12-1-2031')
    for (const iban of [ACCOUNT_IBAN, PAYER_IBAN, TELECOM_IBAN]) expect(sent).not.toContain(iban)
  })
})

describe('an MT940 statement of Halcom e-banking', () => {
  it('goes to the model line by line, its amounts with a decimal comma as written and every account under a token', async () => {
    const lines = (await sentRows(MT940, bytesOf(MT940))).map((row) => row[0] ?? '')

    expect(lines[0]).toMatch(/^\{1:F21HALCOMAXXX/)
    expect(lines).toContain(':60F:C311102EUR1000,00')
    expect(lines).toContain(':61:3111021102D35,50NMSCREF-0003//BANK0003')
    expect(lines).toContain(':62F:C311102EUR1076,50')
    expect(lines.find((line) => line.startsWith(':25:'))).not.toContain(ACCOUNT_IBAN)
    for (const iban of [ACCOUNT_IBAN, PAYER_IBAN, TELECOM_IBAN]) expect(lines.join('\n')).not.toContain(iban)
  })
})

describe('an OFX 1.0.2 file in Windows-1250', () => {
  it('goes to the model line by line, its Croatian letters read, its amounts with a decimal comma as written and its account under a token', async () => {
    const lines = (await sentRows(OFX, bytesOf(OFX))).map((row) => row[0] ?? '')

    expect(lines[0]).toBe('OFXHEADER:100')
    expect(lines).toContain('<MEMO>Plaćanje računa 12-1-2031')
    expect(lines).toContain('<TRNAMT>-35,50')
    expect(lines).toContain('<DTPOSTED>20311102120000[+1:CET]')
    expect(lines.find((line) => line.startsWith('<ACCTID>'))).not.toContain(ACCOUNT_IBAN)
  })
})

function dayOf(text: string): CivilDate {
  return parseCivilDate(text)!
}

/** A day cell as a bank's sheet holds it: the day's serial number under a number format, with a time of day as the fraction. */
function day(date: CivilDate, format: string, fraction = 0): { readonly t: 'n'; readonly v: number; readonly z: string } {
  return { t: 'n', v: serialFromCivilDate(date) + fraction, z: format }
}

function amount(value: number, format = '#,##0.00'): { readonly t: 'n'; readonly v: number; readonly z: string } {
  return { t: 'n', v: value, z: format }
}

/** Excel's short date, which each reader's Excel shows in its own language's order. */
const SHORT_DATE = 'm/d/yy'
const BALANCE_FORMAT = '#,##0.00;[Red]-#,##0.00'

/**
 * A statement sheet of typed cells, newest first, under a title with the account's IBAN, with a total row of formulas.
 * The booking day carries `dd.mm.yyyy`, which SheetJS cannot write, and the value day Excel's short date.
 */
async function statementSheet(bookType: 'xlsx' | 'biff8'): Promise<Uint8Array<ArrayBuffer>> {
  const XLSX = await sheetJs()
  const header = ['Datum knjiženja', 'Datum valute', 'Naziv primatelja / platitelja', 'IBAN primatelja / platitelja', 'Opis plaćanja', 'Isplata', 'Uplata', 'Stanje']
  const sheet = XLSX.utils.aoa_to_sheet([
    [`Promet po računu ${ACCOUNT_IBAN}`],
    ['Razdoblje: 01.11.2031. - 03.11.2031.'],
    [],
    header,
    [day(dayOf('2031-11-03'), 'dd.mm.yyyy'), day(dayOf('2031-11-03'), SHORT_DATE), 'Telekom Primjer d.d.', TELECOM_IBAN, 'HR01 123456-2031', amount(35.5), '', amount(1064.5, BALANCE_FORMAT)],
    [day(dayOf('2031-11-02'), 'dd.mm.yyyy hh:mm', 0.587_5), day(dayOf('2031-11-02'), SHORT_DATE), 'Razni korisnici', '', 'Plaće 10-2031', amount(400), '', amount(1100, BALANCE_FORMAT)],
    [day(dayOf('2031-11-01'), 'dd.mm.yyyy'), day(dayOf('2031-11-01'), SHORT_DATE), 'Primjer Trgovina d.o.o.', PAYER_IBAN, 'Plaćanje računa 12-1-2031', '', amount(500), amount(1500, BALANCE_FORMAT)],
    ['Ukupno', '', '', '', '', { t: 'n', v: 435.5, f: 'SUM(F5:F7)', z: '#,##0.00' }, { t: 'n', v: 500, f: 'SUM(G5:G7)', z: '#,##0.00' }, ''],
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Promet')
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType }) as ArrayBuffer)
}

describe.each([
  ['xlsx', 'promet.xlsx'],
  ['biff8', 'promet.xls'],
] as const)('a statement sheet of typed cells, as %s', (bookType, name) => {
  it('goes to the model with each day as a plain day, never a serial number or month first, and amounts as the sheet shows them', async () => {
    const rows = await sentRows(name, await statementSheet(bookType))
    const sent = JSON.stringify(rows)

    expect(rows[4]?.slice(0, 2)).toEqual(['2031-11-03', '2031-11-03'])
    expect(rows[5]?.slice(0, 2)).toEqual(['2031-11-02 14:06', '2031-11-02'])
    expect(rows[4]?.[5]).toBe('35.50')
    expect(rows[6]?.[7]).toBe('1,500.00')
    expect(rows[7]?.[5]).toBe('435.50')
    expect(sent).not.toMatch(/\b(?:4\d{4}|11\/\d+\/31)\b/)
    for (const iban of [ACCOUNT_IBAN, PAYER_IBAN, TELECOM_IBAN]) expect(sent).not.toContain(iban)
  })

  it("is read on Import by the profile it guesses, each day off the cell's serial, and runs on from the opening it gives", async () => {
    const bytes = await statementSheet(bookType)
    const loaded = await loadImportFile(name, bytes.buffer)
    if (loaded.kind !== 'table') throw new Error('expected a spreadsheet')
    const shape = fileShapeOf(loaded.grid)

    expect(shape?.headerRow).toBe(3)
    expect(shape?.guess).toMatchObject({ date: 'Datum knjiženja', amount: { debit: 'Isplata', credit: 'Uplata' }, balance: 'Stanje', counterpartyIban: 'IBAN primatelja / platitelja' })
    const reading = readTabularStatement(loaded.grid, { ...shape!.guess, name: 'primjer', account: 'main' }, name, 'e'.repeat(64))
    if (!('statement' in reading)) throw new Error(reading.refusal)
    expect(reading.statement.rows.map((row) => [row.date, row.amount, row.balance])).toEqual([
      ['2031-11-01', moneyFromCents(50_000), moneyFromCents(150_000)],
      ['2031-11-02', moneyFromCents(-40_000), moneyFromCents(110_000)],
      ['2031-11-03', moneyFromCents(-3_550), moneyFromCents(106_450)],
    ])
    expect(reading.statement.notes).toEqual(['Row 8 reads "Ukupno" where the date goes, so it is skipped.'])
    expect(reading.statement.opening).toBe(moneyFromCents(100_000))

    const withoutMain = { ...workbook, transactions: workbook.transactions.filter((row) => row.account !== 'main') }
    const run = dryRunFor([reading], withoutMain, new Map([['main', moneyFromCents(100_000)]]))
    expect(run.statements[0]?.refusal).toBeNull()
    expect(run.newRows).toBe(3)
  })
})
