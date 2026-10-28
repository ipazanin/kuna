import { addDays, parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { fakeWorkbookRecords } from '../../../workbook/infrastructure/fake/fakeWorkbook'
import type { CellValue } from '../../../workbook/infrastructure/workbookSnapshot'

/**
 * Two statement files for the fake build's Import tab on Transactions, each carrying on the fake workbook's main
 * account from its newest row: a camt.053 statement with a client payment, a card purchase in
 * dollars, a bank fee and a reversal, and a Croatian bank's xlsx export with a decimal comma,
 * text dates, split debit and credit columns, a title above the header and a total below. Every
 * name, IBAN and amount is made up.
 */
export const SAMPLE_CAMT_FILE_NAME = 'example-bank-statement.xml'
export const SAMPLE_TABLE_FILE_NAME = 'example-bank-export.xlsx'

interface MainAccount {
  readonly iban: string
  readonly date: CivilDate
  readonly balance: number
  readonly sequence: number
}

function mainAccount(): MainAccount {
  const records = fakeWorkbookRecords('drive')
  const newest = records['ledger-row']!.find((row) => row.account === 'main')!
  const iban = String(records.account!.find((row) => row.account === 'main')!.iban)
  return { iban, date: parseCivilDate(String(newest.date))!, balance: Number(newest.balance), sequence: Number(/-statement-(\d+)$/.exec(String(newest.statement))![1]) }
}

interface SampleEntry {
  readonly credit: boolean
  readonly cents: number
  readonly codes: readonly [string, string, string]
  readonly reference: string
  readonly party: string
  readonly description: string
  readonly reversal?: true
  readonly instructedCurrency?: string
}

/** The camt statement's booking day four days after the main account's newest row, the day after that it is made, and its number, the account's next. */
function sampleCamtShape(main: MainAccount): { readonly booked: CivilDate; readonly created: CivilDate; readonly sequence: number } {
  const booked = addDays(main.date, 4)
  return { booked, created: addDays(booked, 1), sequence: main.sequence + 1 }
}

/** The camt statement's label, as the reader names it from the day it was made and its number, the main account's next unless given. */
export function sampleCamtLabel(sequence?: number): string {
  const shape = sampleCamtShape(mainAccount())
  return `${shape.created}-statement-${String(sequence ?? shape.sequence).padStart(3, '0')}`
}

/**
 * A camt.053.001.08 statement booked four days after the main account's newest row, of the main
 * account, or of another IBAN as that account's statement with the given number.
 */
export function sampleCamtXml(other?: { readonly iban: string; readonly sequence: number }): string {
  const main = mainAccount()
  const shape = sampleCamtShape(main)
  const { booked, created } = shape
  const sequence = other?.sequence ?? shape.sequence
  const client = 'XX00FAKE0000000000000010'
  const entries: SampleEntry[] = [
    {
      credit: true,
      cents: 712_000,
      codes: ['PMNT', 'RCDT', 'ESCT'],
      reference: 'SAMPLE-CAMT-0001',
      party: `<Dbtr><Pty><Nm>Northwind Analytics Ltd</Nm></Pty></Dbtr><DbtrAcct><Id><IBAN>${client}</IBAN></Id></DbtrAcct>`,
      description: 'Invoice 9-1-26',
    },
    {
      credit: false,
      cents: 5_834,
      codes: ['PMNT', 'CCRD', 'POSD'],
      reference: 'SAMPLE-CAMT-0002',
      party: '<Cdtr><Pty><Nm>MODEL API SUBSCRIPTION</Nm></Pty></Cdtr>',
      description: 'Card purchase, monthly plan',
      instructedCurrency: 'USD',
    },
    { credit: false, cents: 785, codes: ['ACMT', 'MDOP', 'CHRG'], reference: 'SAMPLE-CAMT-0003', party: '', description: 'Account fee' },
    {
      credit: true,
      cents: 640,
      codes: ['PMNT', 'CCRD', 'POSD'],
      reference: 'SAMPLE-CAMT-0004',
      party: '<Cdtr><Pty><Nm>SNACK KIOSK</Nm></Pty></Cdtr>',
      description: 'Card purchase reversed',
      reversal: true,
    },
  ]
  const opening = Math.round(main.balance * 100)
  const credits = entries.filter((entry) => entry.credit)
  const debits = entries.filter((entry) => !entry.credit)
  const sum = (side: readonly SampleEntry[]): number => side.reduce((total, entry) => total + entry.cents, 0)
  const closing = opening + sum(credits) - sum(debits)
  const money = (cents: number): string => (cents / 100).toFixed(2)
  const entryXml = (entry: SampleEntry): string => `
      <Ntry>
        <NtryRef>${entry.reference}</NtryRef>
        <Amt Ccy="EUR">${money(entry.cents)}</Amt>
        <CdtDbtInd>${entry.credit ? 'CRDT' : 'DBIT'}</CdtDbtInd>
        <RvslInd>${entry.reversal ? 'true' : 'false'}</RvslInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>${booked}</Dt></BookgDt>
        <ValDt><Dt>${booked}</Dt></ValDt>
        <AcctSvcrRef>${entry.reference}</AcctSvcrRef>
        <BkTxCd><Domn><Cd>${entry.codes[0]}</Cd><Fmly><Cd>${entry.codes[1]}</Cd><SubFmlyCd>${entry.codes[2]}</SubFmlyCd></Fmly></Domn></BkTxCd>${
          entry.party === ''
            ? `
        <AddtlNtryInf>${entry.description}</AddtlNtryInf>`
            : `
        <NtryDtls>
          <TxDtls>
            <Refs><AcctSvcrRef>${entry.reference}</AcctSvcrRef></Refs>
            <AmtDtls><TxAmt><Amt Ccy="EUR">${money(entry.cents)}</Amt></TxAmt>${entry.instructedCurrency ? `<InstdAmt><Amt Ccy="${entry.instructedCurrency}">${money(Math.round(entry.cents * 1.08))}</Amt></InstdAmt>` : ''}</AmtDtls>
            <RltdPties>${entry.party}</RltdPties>
            <RmtInf><Ustrd>${entry.description}</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>`
        }
      </Ntry>`
  return `<?xml version="1.0" encoding="utf-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>SAMPLE-${sequence}</MsgId><CreDtTm>${created}T06:00:00.000</CreDtTm></GrpHdr>
    <Stmt>
      <Id>SAMPLE/${sequence}/001</Id>
      <LglSeqNb>${sequence}</LglSeqNb>
      <CreDtTm>${created}T06:00:00.000</CreDtTm>
      <Acct>
        <Id><IBAN>${other?.iban ?? main.iban}</IBAN></Id>
        <Ccy>EUR</Ccy>
        <Nm>Example Studio d.o.o.</Nm>
        <Svcr><FinInstnId><BICFI>EXMPHR22</BICFI><Nm>Example Bank d.d.</Nm></FinInstnId></Svcr>
      </Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${money(opening)}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>${booked}</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${money(closing)}</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>${booked}</Dt></Dt></Bal>
      <TxsSummry>
        <TtlCdtNtries><NbOfNtries>${credits.length}</NbOfNtries><Sum>${money(sum(credits))}</Sum></TtlCdtNtries>
        <TtlDbtNtries><NbOfNtries>${debits.length}</NbOfNtries><Sum>${money(sum(debits))}</Sum></TtlDbtNtries>
      </TxsSummry>${entries.map(entryXml).join('')}
    </Stmt>
  </BkToCstmrStmt>
</Document>
`
}

/** The export's first sheet: the bank's title lines, the header, the rows newest first, and a total. */
export function sampleTableGrid(): CellValue[][] {
  const main = mainAccount()
  const day = (offset: number): string => {
    const [year, month, date] = addDays(main.date, offset).split('-')
    return `${date}.${month}.${year}`
  }
  const rows: { readonly date: string; readonly party: string; readonly iban: string; readonly text: string; readonly cents: number }[] = [
    { date: day(4), party: 'Northwind Analytics Ltd', iban: 'XX00FAKE0000000000000010', text: 'Invoice 9-1-26', cents: 715_000 },
    { date: day(5), party: 'PHONE NETWORK', iban: '', text: 'Card purchase, mobile plan', cents: -1_420 },
    { date: day(6), party: 'Brightdesk Accounting', iban: 'XX00FAKE0000000000000040', text: 'Bookkeeping 2026-09', cents: -15_000 },
    { date: day(6), party: 'CODE HOST INC', iban: '', text: 'Card purchase, monthly plan', cents: -1_000 },
  ]
  const comma = (cents: number): string =>
    (Math.abs(cents) / 100)
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+,)/g, '.')
  let balance = Math.round(main.balance * 100)
  const lines = rows.map((row) => {
    balance += row.cents
    return [row.date, row.party, row.iban, row.text, row.cents < 0 ? comma(row.cents) : '', row.cents > 0 ? comma(row.cents) : '', comma(balance)]
  })
  return [
    ['Promet po računu'],
    [`IBAN: ${main.iban}`],
    [],
    ['Datum knjiženja', 'Naziv primatelja / platitelja', 'IBAN', 'Opis plaćanja', 'Isplata', 'Uplata', 'Stanje'],
    ...lines.reverse(),
    ['Ukupno', '', '', '', comma(rows.filter((row) => row.cents < 0).reduce((total, row) => total + row.cents, 0)), comma(rows.filter((row) => row.cents > 0).reduce((total, row) => total + row.cents, 0)), ''],
  ]
}

/** The export as xlsx bytes, written by SheetJS, which loads only now. */
export async function sampleTableFile(): Promise<Uint8Array> {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sampleTableGrid()), 'Promet')
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
