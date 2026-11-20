// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { readStatementMail } from '../src/apps/company/mail/application/statementMail'
import type { KnownAttachment } from '../src/apps/company/mail/application/statementMail'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { mailWindow } from '../src/shared/mail/domain/mailSource'
import type { Account } from '../src/apps/company/workbook/domain/workbook'
import { civil } from './fixtures/ledger'
import { testMailbox } from './fixtures/mailbox'
import type { TestMail } from './fixtures/mailbox'

const MAIN_IBAN = 'XX00FAKE0000000001'
const OTHER_IBAN = 'XX00FAKE0000000099'
const MAIN: Account = { slug: 'main', iban: MAIN_IBAN, currency: '', intake: { rowsFrom: 'mail', startsOn: civil('2026-10-01'), alsoFrom: [] } }

/** A camt.053 statement of one entry, numbered `sequence` and made on `day`. */
function camt(iban: string, sequence: number, day: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>TEST-${sequence}</MsgId><CreDtTm>${day}T06:00:00</CreDtTm></GrpHdr>
    <Stmt>
      <LglSeqNb>${sequence}</LglSeqNb>
      <CreDtTm>${day}T06:00:00</CreDtTm>
      <Acct><Id><IBAN>${iban}</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>${day}</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">11.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>${day}</Dt></Dt></Bal>
      <Ntry>
        <NtryRef>E-${sequence}</NtryRef>
        <Amt Ccy="EUR">1.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>${day}</Dt></BookgDt>
        <AcctSvcrRef>E-${sequence}</AcctSvcrRef>
        <AddtlNtryInf>Entry ${sequence}</AddtlNtryInf>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>
`
}

const SINCE = Date.parse('2026-10-01T00:00:00Z')

function read(mails: readonly TestMail[], known = new Map<string, KnownAttachment>(), pageSize = 500) {
  const mailbox = testMailbox(mails, pageSize)
  const plan = readStatementMail({
    mailbox,
    search: { senders: ['statements@bank.example.com'], subject: 'Izvadak' },
    window: mailWindow(null, SINCE),
    workbook: { accounts: [MAIN] },
    load: loadImportFile,
    known,
  })
  return { mailbox, plan }
}

describe("reading the bank's statement mail", () => {
  it('reads the camt XML of each mail, oldest first over every page, and passes over the PDF and the HTML copy beside it, downloading neither', async () => {
    const { mailbox, plan } = read(
      [
        { id: 'm2', subject: 'Izvadak 004', at: '2026-10-08T05:00:00Z', attachments: [['IZV_2026_10_08.xml', camt(MAIN_IBAN, 4, '2026-10-08')]] },
        {
          id: 'm1',
          subject: 'Izvadak 003',
          at: '2026-10-07T05:00:00Z',
          attachments: [
            ['IZV_2026_10_07.pdf', 'pdf'],
            ['IZV_2026_10_07.html', 'html'],
            ['IZV_2026_10_07.xml', camt(MAIN_IBAN, 3, '2026-10-07')],
          ],
        },
      ],
      new Map(),
      1,
    )
    const { entries, readings, query } = await plan

    expect(query).toBe(`from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:${SINCE / 1000}`)
    expect(entries.map((entry) => [entry.mail.id, entry.attachment, entry.kind])).toEqual([
      ['m1', 'IZV_2026_10_07.pdf', 'passed-over'],
      ['m1', 'IZV_2026_10_07.html', 'passed-over'],
      ['m1', 'IZV_2026_10_07.xml', 'read'],
      ['m2', 'IZV_2026_10_08.xml', 'read'],
    ])
    expect(readings.map((reading) => ('statement' in reading ? [reading.statement.label, reading.statement.account] : reading.label))).toEqual([
      ['2026-10-07-statement-003', 'main'],
      ['2026-10-08-statement-004', 'main'],
    ])
    expect(mailbox.downloads).toEqual(['m1/2', 'm2/0'])
  })

  it('reads a statement the bank mailed again a day later under another label once', async () => {
    const { plan } = read([
      { id: 'm1', subject: 'Izvadak 003', at: '2026-10-07T05:00:00Z', attachments: [['a.xml', camt(MAIN_IBAN, 3, '2026-10-07')]] },
      { id: 'm2', subject: 'Izvadak 003', at: '2026-10-08T05:00:00Z', attachments: [['b.xml', camt(MAIN_IBAN, 3, '2026-10-08')]] },
    ])
    const { entries, readings } = await plan

    expect(entries.map((entry) => entry.kind)).toEqual(['read', 'read'])
    expect(readings.map((reading) => ('statement' in reading ? reading.statement.label : reading.label))).toEqual(['2026-10-07-statement-003'])
  })

  it('reads a statement of an IBAN no account has with the account it offers to add', async () => {
    const { plan } = read([{ id: 'm1', subject: 'Izvadak 001', at: '2026-10-07T05:00:00Z', attachments: [['a.xml', camt(OTHER_IBAN, 1, '2026-10-07')]] }])

    expect((await plan).readings).toMatchObject([{ statement: { account: '', label: '2026-10-07-statement-001' }, newAccount: { iban: OTHER_IBAN } }])
  })

  it('lists an XML that is no statement, or no XML at all, with why, and files nothing of it', async () => {
    const { plan } = read([
      {
        id: 'm1',
        subject: 'Izvadak 000, novi uvjeti',
        at: '2026-10-07T05:00:00Z',
        attachments: [
          ['uvjeti.xml', '<obavijest>Uvjeti</obavijest>'],
          ['broken.xml', '<Document><nothing'],
        ],
      },
    ])
    const { entries, readings } = await plan

    expect(entries).toMatchObject([
      { kind: 'not-read', attachment: 'uvjeti.xml', reason: 'It is not a camt.053 statement with a creation day and a number.' },
      { kind: 'not-read', attachment: 'broken.xml', reason: 'broken.xml is not well-formed XML, so it cannot be read as a camt.053 statement.' },
    ])
    expect(readings).toEqual([])
  })

  it('reads each attachment of a sync on a timer once, and reads it against the accounts as they are now', async () => {
    const known = new Map<string, KnownAttachment>()
    const mails: TestMail[] = [{ id: 'm1', subject: 'Izvadak 001', at: '2026-10-07T05:00:00Z', attachments: [['a.xml', camt(OTHER_IBAN, 1, '2026-10-07')]] }]
    await read(mails, known).plan
    const mailbox = testMailbox(mails)
    const { readings } = await readStatementMail({
      mailbox,
      search: { senders: ['statements@bank.example.com'], subject: 'Izvadak' },
      window: mailWindow(null, SINCE),
      workbook: { accounts: [MAIN, { ...MAIN, slug: 'other', iban: OTHER_IBAN }] },
      load: loadImportFile,
      known,
    })

    expect(mailbox.downloads).toEqual([])
    expect(readings).toMatchObject([{ statement: { account: 'other' } }])
  })
})
