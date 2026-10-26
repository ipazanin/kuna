// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { readCamtDocument } from '../src/features/imports/domain/camtStatement'
import type { ImportedStatement, StatementReading } from '../src/features/imports/domain/importedStatement'
import { loadImportFile } from '../src/features/imports/infrastructure/importFiles'
import { moneyFromCents } from '../src/shared/money/money'

/** Two consecutive statements of one account, anonymised from real Erste files: same structure, every value invented. */
const FIXTURES = join(import.meta.dirname, 'fixtures', 'camt')
const DEBITS = readFileSync(join(FIXTURES, 'erste-debits.xml'), 'utf8').replace(/^﻿/, '')
const CREDIT = readFileSync(join(FIXTURES, 'erste-credit.xml'), 'utf8').replace(/^﻿/, '')
const OWN_IBAN = 'HR2923400091110000001'
const ACCOUNTS = new Map([[OWN_IBAN, 'main']])


function read(xml: string, accounts: ReadonlyMap<string, string> = ACCOUNTS): StatementReading[] {
  return readCamtDocument(new DOMParser().parseFromString(xml, 'application/xml'), 'statement.xml', accounts)
}

function statementOf(xml: string): ImportedStatement {
  const [reading] = read(xml)
  if (reading === undefined || !('statement' in reading)) {
    throw new Error(`expected a statement, got ${JSON.stringify(reading)}`)
  }
  return reading.statement
}

function refusalOf(xml: string, accounts?: ReadonlyMap<string, string>): string {
  const [reading] = read(xml, accounts)
  if (reading === undefined || !('refusal' in reading)) {
    throw new Error('expected a refusal')
  }
  return reading.refusal
}

/** The fixture's first entry, and the document with it replaced. */
function firstEntry(xml: string): string {
  return xml.slice(xml.indexOf('<Ntry>'), xml.indexOf('</Ntry>') + '</Ntry>'.length)
}

const CREDIT_ENTRY = firstEntry(CREDIT)

function withCreditEntry(change: (entry: string) => string): string {
  return CREDIT.replace(CREDIT_ENTRY, change(CREDIT_ENTRY))
}

describe('reading a camt.053 statement', () => {
  it('reads every entry of the Erste fixture in booking order, closing the chain at CLBD', () => {
    const statement = statementOf(DEBITS)

    expect(statement.account).toBe('main')
    expect(statement.label).toBe('2031-03-11-statement-041')
    expect(statement.source).toEqual({ kind: 'camt', iban: OWN_IBAN, sequence: 41 })
    expect(statement.opening).toBe(moneyFromCents(1_834_512))
    expect(statement.closing).toBe(moneyFromCents(903_013))
    expect(statement.rows).toHaveLength(7)
    expect(statement.rows.at(-1)?.balance).toBe(statement.closing)
    expect(statement.rows.every((row) => row.amount < 0 && row.reviewReasons.length === 0)).toBe(true)
    expect(statement.notes).toEqual([])
  })

  it('takes the creditor of a debit, not the holder named as the ultimate debtor, and the structured remittance as the description', () => {
    const [first] = statementOf(DEBITS).rows

    expect(first).toMatchObject({
      date: '2031-03-10',
      amount: moneyFromCents(-42_030),
      counterparty: 'Health Insurance Fund',
      counterpartyIban: 'HR4620011115259658909',
      description: 'Salary for 2 / 2031',
      reference: expect.stringMatching(/^2031-\d{8}-\d{11}$/),
      signals: { purpose: 'HLTI', txDomain: 'PMNT', txFamily: 'ICDT', txSubFamily: 'NTAV', creditorReference: 'HR687512-98961629619-51700', instructedCurrency: '' },
    })
  })

  it('takes the debtor of a credit, with the creditor reference', () => {
    const [row] = statementOf(CREDIT).rows

    expect(row).toMatchObject({ amount: moneyFromCents(92_315), counterparty: 'Northwind Analytics Ltd', counterpartyIban: 'HR2420011116383368706', description: 'Invoice 3-1-31' })
    expect(statementOf(CREDIT).opening).toBe(statementOf(DEBITS).closing)
  })

  it('reads a file with a byte order mark and CRLF line ends as the bank sends it', async () => {
    const bytes = readFileSync(join(FIXTURES, 'erste-debits.xml'))
    const loaded = await loadImportFile('erste-debits.xml', new Uint8Array(bytes).buffer)

    expect(loaded.kind).toBe('camt')
    expect(loaded.kind === 'camt' && readCamtDocument(loaded.document, loaded.fileName, ACCOUNTS)).toHaveLength(1)
  })

  it('reads each Stmt of a document that carries two', () => {
    const second = CREDIT.slice(CREDIT.indexOf('<Stmt>'), CREDIT.indexOf('</Stmt>') + '</Stmt>'.length)
    const both = DEBITS.replace('</Stmt>', `</Stmt>${second}`)

    expect(read(both).map((reading) => ('statement' in reading ? reading.statement.label : reading.refusal))).toEqual(['2031-03-11-statement-041', '2031-03-12-statement-042'])
  })

  it('refuses one Stmt of two on its own and still reads the other', () => {
    const second = CREDIT.slice(CREDIT.indexOf('<Stmt>'), CREDIT.indexOf('</Stmt>') + '</Stmt>'.length).replace('<Cd>CLBD</Cd>', '<Cd>XXXX</Cd>')
    const readings = read(DEBITS.replace('</Stmt>', `</Stmt>${second}`))

    expect('statement' in readings[0]!).toBe(true)
    expect(readings[1]).toMatchObject({ label: '2031-03-12-statement-042', refusal: 'The statement carries no CLBD balance, so its chain cannot be closed.' })
  })

  it('refuses an Erste statement without TxsSummry, and reads another bank’s with a note', () => {
    const withoutSummary = CREDIT.replace(/<TxsSummry>[\s\S]*<\/TxsSummry>/, '')

    expect(refusalOf(withoutSummary)).toMatch(/carries no TxsSummry, which this bank always sends/)
    const otherBank = statementOf(withoutSummary.replace('<BICFI>ESBCHR22</BICFI>', '<BICFI>EXMPHR22</BICFI>'))
    expect(otherBank.rows).toHaveLength(1)
    expect(otherBank.notes).toEqual(['The statement carries no TxsSummry, so its entries are checked against its balances only, not against counts and totals from the bank.'])
  })

  it('names the servicer on a fee entry by its sub-family code, and never by a family code', () => {
    const servicer = CREDIT.replace('<BICFI>ESBCHR22</BICFI>', '<BICFI>ESBCHR22</BICFI><Nm>Example Bank d.d.</Nm>')
    const fee = (codes: string): string =>
      servicer.replace(CREDIT_ENTRY, CREDIT_ENTRY.replace(/<Domn>[\s\S]*?<\/Domn>/, codes).replace(/<RltdPties>[\s\S]*?<\/RltdPties>/, ''))

    expect(statementOf(fee('<Domn><Cd>ACMT</Cd><Fmly><Cd>MDOP</Cd><SubFmlyCd>NTAV</SubFmlyCd></Fmly></Domn>')).rows[0]?.counterparty).toBe('Example Bank d.d.')
    expect(statementOf(fee('<Domn><Cd>PMNT</Cd><Fmly><Cd>MCOP</Cd><SubFmlyCd>CHRG</SubFmlyCd></Fmly></Domn>')).rows[0]?.counterparty).toBe('Example Bank d.d.')
    expect(statementOf(fee('<Domn><Cd>PMNT</Cd><Fmly><Cd>MCOP</Cd><SubFmlyCd>COMM</SubFmlyCd></Fmly></Domn>')).rows[0]?.counterparty).toBe('Example Bank d.d.')
    expect(statementOf(fee('<Domn><Cd>PMNT</Cd><Fmly><Cd>CHRG</Cd><SubFmlyCd>NTAV</SubFmlyCd></Fmly></Domn>')).rows[0]?.counterparty).toBe('')
  })

  it('flags a reversal, a batched entry, a value date stand-in and a missing reference for review', () => {
    const reversal = statementOf(withCreditEntry((entry) => entry.replace('<RvslInd>false</RvslInd>', '<RvslInd>true</RvslInd>')))
    const legs = CREDIT_ENTRY.slice(CREDIT_ENTRY.indexOf('<TxDtls>'), CREDIT_ENTRY.indexOf('</TxDtls>') + '</TxDtls>'.length)
    const batched = statementOf(withCreditEntry((entry) => entry.replace('</TxDtls>', `</TxDtls>${legs}`)))
    const valueDated = statementOf(withCreditEntry((entry) => entry.replace(/<BookgDt>[\s\S]*?<\/BookgDt>/, '')))
    const unreferenced = statementOf(withCreditEntry((entry) => entry.replace(/<NtryRef>.*?<\/NtryRef>/, '').replace(/(<\/RvslInd>[\s\S]*?)<AcctSvcrRef>.*?<\/AcctSvcrRef>/, '$1')))

    expect(reversal.rows[0]?.reviewReasons).toEqual(['reversal'])
    expect(batched.rows[0]?.reviewReasons).toEqual(['batched entry'])
    expect(valueDated.rows[0]).toMatchObject({ date: '2031-03-11', reviewReasons: ['value date used'] })
    expect(unreferenced.rows[0]).toMatchObject({ reference: '', reviewReasons: ['no bank reference'] })
  })

  it('takes the other side when the counterparty side states this account', () => {
    const own = withCreditEntry((entry) =>
      entry.replace(/<DbtrAcct>[\s\S]*?<IBAN>.*?<\/IBAN>/, `<DbtrAcct><Id><IBAN>${OWN_IBAN}</IBAN>`).replace('<RltdPties>', '<RltdPties><Cdtr><Pty><Nm>Pixel Studio</Nm></Pty></Cdtr>'),
    )

    expect(statementOf(own).rows[0]).toMatchObject({ counterparty: 'Pixel Studio', counterpartyIban: '' })
  })

  it('joins the lines of an unstructured remittance before anything else', () => {
    const lines = withCreditEntry((entry) => entry.replace('<Strd>', '<Ustrd>Invoice 3-1-31 </Ustrd><Ustrd> for March</Ustrd><Strd>'))

    expect(statementOf(lines).rows[0]?.description).toBe('Invoice 3-1-31 for March')
  })

  it('sorts across booking days and keeps the document order within a day', () => {
    const entries = DEBITS.match(/<Ntry>[\s\S]*?<\/Ntry>/g)!
    const later = entries[0]!.replace(/<BookgDt>\s*<Dt>2031-03-10<\/Dt>/, '<BookgDt><Dt>2031-03-11</Dt>')
    const xml = DEBITS.replace(entries[0]!, later)
    const statement = statementOf(xml)

    expect(statement.rows.map((row) => row.date)).toEqual([...Array(6).fill('2031-03-10'), '2031-03-11'])
    expect(statement.rows[0]?.reference).toBe(statementOf(DEBITS).rows[1]?.reference)
  })

  it('leaves a pending entry out, since it has not moved the balance', () => {
    const pending = CREDIT_ENTRY.replace('<Cd>BOOK</Cd>', '<Cd>PDNG</Cd>').replace(/<AcctSvcrRef>(.*?)<\/AcctSvcrRef>/g, '<AcctSvcrRef>PENDING</AcctSvcrRef>')

    expect(statementOf(CREDIT.replace(CREDIT_ENTRY, `${CREDIT_ENTRY}${pending}`)).rows).toHaveLength(1)
  })

  it('reads a camt.053.001.02 document by local names', () => {
    const older = CREDIT.replace('camt.053.001.08', 'camt.053.001.02').replace(/<Sts>\s*<Cd>BOOK<\/Cd>\s*<\/Sts>/, '<Sts>BOOK</Sts>')

    expect(statementOf(older).rows).toHaveLength(1)
  })

  it('reads an overdrawn balance as negative', () => {
    const overdrawn = CREDIT.replace(/(<Cd>OPBD<\/Cd>[\s\S]*?<Amt Ccy="EUR">)9030\.13(<\/Amt>\s*<CdtDbtInd>)CRDT/, '$1100.00$2DBIT').replace(/(<Cd>CLBD<\/Cd>[\s\S]*?<Amt Ccy="EUR">)9953\.28/, '$1823.15')

    expect(statementOf(overdrawn)).toMatchObject({ opening: moneyFromCents(-10_000), closing: moneyFromCents(82_315) })
  })

  it.each([
    ['a chain that does not close', CREDIT.replace(/(<Cd>CLBD<\/Cd>[\s\S]*?<Amt Ccy="EUR">)9953\.28/, '$19953.29'), /^The balance chain does not close: opening 9030\.13 plus credits 923\.15 less debits 0\.00 is 9953\.28, but CLBD reports 9953\.29\.$/],
    ['a count the summary does not report', CREDIT.replace(/(<TtlCdtNtries>\s*<NbOfNtries>)1/, '$12'), /^TtlCdtNtries reports 2 entries but 1 booked credit entries were read\.$/],
    ['a sum the summary does not report', CREDIT.replace(/(<TtlCdtNtries>[\s\S]*?<Sum>)923\.15/, '$1923.16'), /^TtlCdtNtries reports 923\.16 but the booked credit entries sum to 923\.15\.$/],
    ['a negative amount', withCreditEntry((entry) => entry.replace('<Amt Ccy="EUR">923.15</Amt>', '<Amt Ccy="EUR">-923.15</Amt>')), /is "-923\.15", but a camt amount is unsigned/],
    ['a localised amount', withCreditEntry((entry) => entry.replace('<Amt Ccy="EUR">923.15</Amt>', '<Amt Ccy="EUR">923,15</Amt>')), /is "923,15", which is not a number/],
    ['an amount finer than a cent', withCreditEntry((entry) => entry.replace('<Amt Ccy="EUR">923.15</Amt>', '<Amt Ccy="EUR">923.155</Amt>')), /which is finer than a cent/],
    ['an entry in another currency', withCreditEntry((entry) => entry.replace('<Amt Ccy="EUR">923.15</Amt>', '<Amt Ccy="USD">923.15</Amt>')), /is in USD but the account is in EUR/],
    ['an entry without a direction', withCreditEntry((entry) => entry.replace('<CdtDbtInd>CRDT</CdtDbtInd>', '<CdtDbtInd>BOTH</CdtDbtInd>')), /carries CdtDbtInd "BOTH"/],
  ])('refuses %s', (_case, xml, reason) => {
    expect(refusalOf(xml)).toMatch(reason)
  })

  it('reads a statement whose IBAN the accounts tab does not name with no account, offering that account by its IBAN and currency', () => {
    expect(read(CREDIT, new Map())[0]).toMatchObject({ statement: { account: '', label: '2031-03-12-statement-042' }, newAccount: { iban: OWN_IBAN, currency: 'EUR' } })
  })

  it('refuses a statement that names no IBAN', () => {
    expect(refusalOf(CREDIT.replace(`<IBAN>${OWN_IBAN}</IBAN>`, '<IBAN></IBAN>'), new Map())).toBe('The statement names no Acct/Id/IBAN, so the app cannot tell whose account it is.')
  })

  it('throws for a document with no statement in it', () => {
    expect(() => read('<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08"><BkToCstmrDbtCdtNtfctn/></Document>')).toThrow('is not a camt.053 statement')
  })
})
