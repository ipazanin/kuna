// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { planLine, planMail } from '../src/features/mail/application/mailFiling'
import type { MailFolders, MailSource, Mailbox, PlanEntry, SourcePlan } from '../src/features/mail/application/mailFiling'
import { statementMailSource } from '../src/features/mail/application/statementMailSource'
import { loadImportFile } from '../src/features/imports/infrastructure/importFiles'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import type { Settings } from '../src/features/settings/domain/settings'
import type { Workbook } from '../src/features/workbook/domain/workbook'
import { GoogleApiError } from '../src/shared/google/googleApi'
import { exampleStudio } from './fixtures/exampleStudio'
import { hashOf, testFolders, testMailbox } from './fixtures/mailbox'
import type { TestFiled, TestMail } from './fixtures/mailbox'

/** A statement anonymised from a real bank's camt file, label 2031-03-12-statement-042, of the IBAN below. */
const CREDIT = readFileSync(join(import.meta.dirname, 'fixtures', 'camt', 'erste-credit.xml'), 'utf8').replace(/^﻿/, '')
/** The same statement redelivered the next day, which gives it another label. */
const REDELIVERED = CREDIT.replaceAll('2031-03-12T03:00:10.358', '2031-03-13T03:05:00.000')
const OWN_IBAN = 'HR2923400091110000001'

const FOLDER = ['work', 'bank', 'statements']
const STATEMENTS = statementMailSource(loadImportFile, 'Europe/Zagreb')
const SINCE = Date.parse('2030-12-31T23:00:00Z')

function books(settings: Partial<Settings> = {}): Workbook {
  return exampleStudio({
    accounts: [{ slug: 'main', iban: OWN_IBAN, currency: '' }],
    settings: { ...DEFAULT_SETTINGS, ownerPayModule: true, statementsFolder: FOLDER, statementsMailFrom: ['statements@bank.example.com'], statementsMailSubject: 'Izvadak', ...settings },
  })
}

async function plan(mails: readonly TestMail[], filed: readonly TestFiled[] = [], options: { readonly workbook?: Workbook; readonly mailbox?: Mailbox; readonly folders?: MailFolders; readonly sources?: readonly MailSource[] } = {}) {
  return planMail({
    mailbox: options.mailbox ?? testMailbox(mails),
    folders: options.folders ?? testFolders(filed),
    sources: options.sources ?? [STATEMENTS],
    workbook: options.workbook ?? books(),
    sinceStart: SINCE,
    hash: hashOf,
    report: () => {},
  })
}

function entriesOf(source: SourcePlan | undefined): readonly PlanEntry[] {
  if (source?.kind !== 'planned') throw new Error(`expected a planned source, got ${JSON.stringify(source)}`)
  return source.entries
}

/** Each entry as its kind and its target, or the attachment for one no rule matched. */
function targets(source: SourcePlan | undefined): string[] {
  return entriesOf(source).map((entry) => `${entry.kind} ${entry.kind === 'unmatched' ? entry.attachment : [...entry.path, entry.name].join('/')}`)
}

describe('the bank statements in mail', () => {
  it('names a statement PDF and its camt XML of one mail as the fetch names them, the PDF by its day and the subject’s number, the XML by its label and the account the books give its IBAN', async () => {
    const mails: TestMail[] = [
      {
        id: 'pair',
        subject: 'Izvadak 042, Example Studio d.o.o.',
        at: '2031-03-12T04:00:00Z',
        attachments: [
          ['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf'],
          ['IZV_2031_03_12 03_05_19_314_503.xml', CREDIT],
        ],
      },
    ]

    const { sources } = await plan(mails)

    expect(targets(sources[0])).toEqual(['file work/bank/statements/2031-statements/2031-03-12-statement-042.pdf', 'file work/bank/statements/2031-statements/2031-03-12-statement-042-main.xml'])
    expect(sources[0]).toMatchObject({ kind: 'planned', label: 'Bank statements', window: { from: SINCE, after: 'since' } })
  })

  it('skips a statement delivered twice, the second time a day later under another label, and one its folder holds already', async () => {
    const mails: TestMail[] = [
      { id: 'first', subject: 'Izvadak 042', at: '2031-03-12T04:00:00Z', attachments: [['izvod.xml', CREDIT]] },
      { id: 'again', subject: 'RE: Izvadak 042', at: '2031-03-13T04:00:00Z', attachments: [['izvod.xml', REDELIVERED]] },
    ]

    const fresh = await plan(mails)
    const filed = await plan(mails, [{ folders: ['2031-statements'], name: '2031-03-12-statement-042-main.xml', created: '2031-03-12T05:00:00Z', content: null }])

    expect(targets(fresh.sources[0])).toEqual(['file work/bank/statements/2031-statements/2031-03-12-statement-042-main.xml', 'already work/bank/statements/2031-statements/2031-03-13-statement-042-main.xml'])
    expect(targets(filed.sources[0]).map((target) => target.split(' ')[0])).toEqual(['already', 'already'])
    expect(planLine(filed)).toBe('Nothing new, already there 2.')
  })

  it('names a statement of an IBAN no account has by its label alone, so another account’s statement of the same number is not taken for it', async () => {
    const { sources } = await plan(
      [{ id: 'unknown', subject: 'Izvadak 042', at: '2031-03-12T04:00:00Z', attachments: [['izvod.xml', CREDIT]] }],
      [{ folders: ['2031-statements'], name: '2031-03-12-statement-042-second.xml', created: '2031-03-12T05:00:00Z', content: null }],
      { workbook: exampleStudio({ settings: books().settings, accounts: [] }) },
    )

    expect(targets(sources[0])).toEqual(['file work/bank/statements/2031-statements/2031-03-12-statement-042.xml'])
  })

  it('files a PDF of another shape under the day of the mail and the bank’s own name, and leaves an XML it cannot read unmatched with why', async () => {
    const { sources } = await plan([
      { id: 'other', subject: 'Izvadak, Example Studio d.o.o.', at: '2031-03-31T22:30:00Z', attachments: [['Statement March.pdf', 'pdf'], ['broken.xml', '<Document><BkToCstmrStmt>']] },
      { id: 'no-number', subject: 'Izvadak', at: '2031-03-13T04:00:00Z', attachments: [['IZV_2031_03_13 03_05_19_314_503.pdf', 'pdf']] },
    ])

    expect(targets(sources[0])).toEqual([
      'file work/bank/statements/2031-statements/2031-03-13-IZV_2031_03_13 03_05_19_314_503.pdf',
      'file work/bank/statements/2031-statements/2031-04-01-Statement March.pdf',
      'unmatched broken.xml',
    ])
    expect(entriesOf(sources[0]).filter((entry) => entry.kind === 'unmatched').map((entry) => 'reason' in entry && entry.reason)).toEqual([
      'broken.xml is not well-formed XML, so it cannot be read as a camt.053 statement.',
    ])
  })

  it('passes over the HTML copy the bank mails beside each PDF, and anything else that is neither a PDF nor an XML, as the fetch does', async () => {
    const { sources } = await plan([
      { id: 'pdf', subject: 'Izvadak 042, Example Studio d.o.o.', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf']] },
      { id: 'html', subject: 'Izvadak 042, Example Studio d.o.o.', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.html', 'html'], ['Terms.docx', 'docx']] },
    ])

    expect(targets(sources[0])).toEqual(['file work/bank/statements/2031-statements/2031-03-12-statement-042.pdf'])
    expect(planLine({ sources })).toBe('Would file 1.')
  })

  it('reads the statement number after the phrase wherever the subject carries it, as the fetch does', async () => {
    const { sources } = await plan(
      [{ id: 'pdf', subject: 'EXAMPLE BANK Izvadak 042, Example Studio d.o.o.', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf']] }],
      [{ folders: ['2031-statements'], name: '2031-03-12-statement-042.pdf', created: '2031-03-12T05:00:00Z', content: null }],
    )

    expect(targets(sources[0])).toEqual(['already work/bank/statements/2031-statements/2031-03-12-statement-042.pdf'])
  })

  it('stays off without a sender or a subject, and fails without a folder to check against', async () => {
    expect((await plan([], [], { workbook: books({ statementsMailFrom: [] }) })).sources).toEqual([])
    expect((await plan([], [], { workbook: books({ statementsMailSubject: '' }) })).sources).toEqual([])
    expect((await plan([], [], { workbook: books({ statementsFolder: [] }) })).sources).toEqual([
      { kind: 'failed', id: 'statements', label: 'Bank statements', reason: 'Settings, General names no folder for it, so there is nowhere to look for what is filed' },
    ])
  })
})

describe('the mail step', () => {
  it('searches from the mail-since day before the app filed anything for a source, and from a week before the newest mail it filed after', async () => {
    const fresh = testMailbox([])
    const later = testMailbox([])

    await plan([], [], { mailbox: fresh })
    await plan([], [], { mailbox: later, folders: testFolders([], { statements: '2031-03-20T08:00:00Z' }) })

    expect(fresh.queries).toEqual([`from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:${SINCE / 1000}`])
    expect(later.queries).toEqual([`from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:${Date.parse('2031-03-13T08:00:00Z') / 1000}`])
  })

  it('reads every page of a search and plans the mail oldest first', async () => {
    const mails: TestMail[] = Array.from({ length: 5 }, (_, index) => ({
      id: `m${index}`,
      subject: `Izvadak 00${index + 1}`,
      at: `2031-03-1${index}T04:00:00Z`,
      attachments: [[`IZV_2031_03_1${index} 03_05_19_314_503.pdf`, `pdf ${index}`]],
    }))
    const mailbox = testMailbox(mails, 2)

    const { sources } = await plan(mails, [], { mailbox })

    expect(mailbox.queries).toHaveLength(3)
    expect(targets(sources[0]).map((target) => target.split('/').at(-1))).toEqual(['2031-03-10-statement-001.pdf', '2031-03-11-statement-002.pdf', '2031-03-12-statement-003.pdf', '2031-03-13-statement-004.pdf', '2031-03-14-statement-005.pdf'])
  })

  it('lets a source that fails leave the others running, and says both in its line', async () => {
    const failing: MailSource = {
      id: 'broken',
      label: 'VAT returns',
      duplicates: 'correction',
      terms: () => ({ senders: ['office@accountant.example.com'], subject: 'PDV za', folder: ['finance', 'vat'] }),
      name: async () => [],
    }
    const mails: TestMail[] = [{ id: 'pdf', subject: 'Izvadak 042', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf']] }]
    const working = testMailbox(mails)
    const mailbox: Mailbox = {
      ...working,
      search: async (query, page) => {
        if (query.includes('PDV za')) throw new Error('Gmail did not answer')
        return working.search(query, page)
      },
    }

    const result = await plan(mails, [], { sources: [failing, STATEMENTS], mailbox })

    expect(result.sources.map((source) => [source.id, source.kind])).toEqual([
      ['broken', 'failed'],
      ['statements', 'planned'],
    ])
    expect(planLine(result)).toBe('Would file 1. VAT returns: Gmail did not answer.')
  })

  it('hands Google turning its token away to the sync, so it can ask for access', async () => {
    const mailbox: Mailbox = {
      ...testMailbox([]),
      search: async () => {
        throw new GoogleApiError('https://gmail.googleapis.com/gmail/v1/users/me/messages', 401, '{"error":{"code":401}}')
      },
    }

    await expect(plan([], [], { mailbox })).rejects.toBeInstanceOf(GoogleApiError)
  })

  it('reads a PDF’s bytes from Gmail only to compare them, never to name it', async () => {
    const mailbox = testMailbox([{ id: 'pdf', subject: 'Izvadak 042', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf']] }])

    await plan([], [], { mailbox })

    expect(mailbox.downloads).toEqual([])
  })
})
