// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MailRateLimited, fileMail, hasProblem, planLine } from '../src/apps/company/mail/application/mailFiling'
import type { MailFolders, MailSource, Mailbox, PlanEntry, SourcePlan } from '../src/apps/company/mail/application/mailFiling'
import { statementMailSource } from '../src/apps/company/mail/application/statementMailSource'
import { mailSinceDefault, yearFolderName, yearsSince } from '../src/apps/company/mail/domain/mailSource'
import type { AttachmentNaming } from '../src/apps/company/mail/domain/mailSource'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { Settings } from '../src/apps/company/settings/domain/settings'
import type { Workbook } from '../src/apps/company/workbook/domain/workbook'
import { startOfDayIn } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
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

async function plan(
  mails: readonly TestMail[],
  filed: readonly TestFiled[] = [],
  options: {
    readonly workbook?: Workbook
    readonly mailbox?: Mailbox
    readonly folders?: MailFolders
    readonly sources?: readonly MailSource[]
    readonly opened?: string[]
    readonly reports?: string[]
  } = {},
) {
  const mailbox = options.mailbox ?? testMailbox(mails)
  const folders = options.folders ?? testFolders(filed)
  return fileMail({
    open: async () => {
      options.opened?.push('opened')
      return { mailbox, folders }
    },
    sources: options.sources ?? [STATEMENTS],
    workbook: options.workbook ?? books(),
    sinceStart: SINCE,
    years: [2031],
    hash: hashOf,
    report: (line) => options.reports?.push(line),
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

    expect(targets(sources[0])).toEqual(['filed work/bank/statements/2031-statements/2031-03-12-statement-042.pdf', 'filed work/bank/statements/2031-statements/2031-03-12-statement-042-main.xml'])
    expect(sources[0]).toMatchObject({ kind: 'planned', label: 'Bank statements', window: { from: SINCE, after: 'since' } })
  })

  it('skips a statement delivered twice, the second time a day later under another label, and one its folder holds already', async () => {
    const mails: TestMail[] = [
      { id: 'first', subject: 'Izvadak 042', at: '2031-03-12T04:00:00Z', attachments: [['izvod.xml', CREDIT]] },
      { id: 'again', subject: 'RE: Izvadak 042', at: '2031-03-13T04:00:00Z', attachments: [['izvod.xml', REDELIVERED]] },
    ]

    const fresh = await plan(mails)
    const filed = await plan(mails, [{ folders: ['2031-statements'], name: '2031-03-12-statement-042-main.xml', created: '2031-03-12T05:00:00Z', content: null }])

    expect(targets(fresh.sources[0])).toEqual([
      'filed work/bank/statements/2031-statements/2031-03-12-statement-042-main.xml',
      'already work/bank/statements/2031-statements/2031-03-13-statement-042-main.xml',
    ])
    expect(targets(filed.sources[0]).map((target) => target.split(' ')[0])).toEqual(['already', 'already'])
    expect(planLine(filed)).toBe('Nothing new, already there 2.')
  })

  it('names a statement of an IBAN no account has by its label alone, so another account’s statement of the same number is not taken for it', async () => {
    const { sources } = await plan(
      [{ id: 'unknown', subject: 'Izvadak 042', at: '2031-03-12T04:00:00Z', attachments: [['izvod.xml', CREDIT]] }],
      [{ folders: ['2031-statements'], name: '2031-03-12-statement-042-second.xml', created: '2031-03-12T05:00:00Z', content: null }],
      { workbook: exampleStudio({ settings: books().settings, accounts: [] }) },
    )

    expect(targets(sources[0])).toEqual(['filed work/bank/statements/2031-statements/2031-03-12-statement-042.xml'])
  })

  it('files a PDF of another shape under the day of the mail and the bank’s own name, and leaves an XML it cannot read unmatched with why', async () => {
    const { sources } = await plan([
      {
        id: 'other',
        subject: 'Izvadak, Example Studio d.o.o.',
        at: '2031-03-31T22:30:00Z',
        attachments: [
          ['Statement March.pdf', 'pdf'],
          ['broken.xml', '<Document><BkToCstmrStmt>'],
        ],
      },
      { id: 'no-number', subject: 'Izvadak', at: '2031-03-13T04:00:00Z', attachments: [['IZV_2031_03_13 03_05_19_314_503.pdf', 'pdf']] },
    ])

    expect(targets(sources[0])).toEqual([
      'filed work/bank/statements/2031-statements/2031-03-13-IZV_2031_03_13 03_05_19_314_503.pdf',
      'filed work/bank/statements/2031-statements/2031-04-01-Statement March.pdf',
      'unmatched broken.xml',
    ])
    expect(
      entriesOf(sources[0])
        .filter((entry) => entry.kind === 'unmatched')
        .map((entry) => 'reason' in entry && entry.reason),
    ).toEqual(['broken.xml is not well-formed XML, so it cannot be read as a camt.053 statement.'])
  })

  it('passes over the HTML copy the bank mails beside each PDF, and anything else that is neither a PDF nor an XML, as the fetch does', async () => {
    const { sources } = await plan([
      { id: 'pdf', subject: 'Izvadak 042, Example Studio d.o.o.', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf']] },
      {
        id: 'html',
        subject: 'Izvadak 042, Example Studio d.o.o.',
        at: '2031-03-12T04:00:00Z',
        attachments: [
          ['IZV_2031_03_12 03_05_19_314_503.html', 'html'],
          ['Terms.docx', 'docx'],
        ],
      },
    ])

    expect(targets(sources[0])).toEqual(['filed work/bank/statements/2031-statements/2031-03-12-statement-042.pdf'])
    expect(planLine({ sources })).toBe('Filed 1.')
  })

  it('reads the statement number after the phrase wherever the subject carries it, as the fetch does', async () => {
    const { sources } = await plan(
      [{ id: 'pdf', subject: 'EXAMPLE BANK Izvadak 042, Example Studio d.o.o.', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf']] }],
      [{ folders: ['2031-statements'], name: '2031-03-12-statement-042.pdf', created: '2031-03-12T05:00:00Z', content: null }],
    )

    expect(targets(sources[0])).toEqual(['already work/bank/statements/2031-statements/2031-03-12-statement-042.pdf'])
  })

  it('stays off without a sender or a subject, and fails without a folder to check against, opening neither Gmail nor Drive', async () => {
    const opened: string[] = []

    expect((await plan([], [], { workbook: books({ statementsMailFrom: [] }), opened })).sources).toEqual([])
    expect((await plan([], [], { workbook: books({ statementsMailSubject: '' }), opened })).sources).toEqual([])
    const folderless = await plan([], [], { workbook: books({ statementsFolder: [] }), opened })

    expect(folderless.sources).toEqual([{ kind: 'failed', id: 'statements', label: 'Bank statements', reason: 'It is on, but has no folder on Settings, General' }])
    expect(planLine(folderless)).toBe('Bank statements: It is on, but has no folder on Settings, General.')
    expect(opened).toEqual([])
  })
})

describe('the mail step', () => {
  it('searches from the mail-since day while its year folders are empty, and from a week before the mail of the newest file the app filed', async () => {
    const fresh = testMailbox([])
    const later = testMailbox([])
    const filed: TestFiled = { folders: ['2031-statements'], name: '2031-03-20-statement-050.pdf', created: '2031-03-21T09:00:00Z', content: null, filedFrom: '2031-03-20T08:00:00Z' }

    await plan([], [], { mailbox: fresh })
    await plan([], [filed], { mailbox: later })

    expect(fresh.queries).toEqual([`from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:${SINCE / 1000}`])
    expect(later.queries).toEqual([`from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:${Date.parse('2031-03-13T08:00:00Z') / 1000}`])
  })

  it('moves the window past mail another app filed, from when Drive made its newest file, so mail found already there is not read again on every sync', async () => {
    const mails: TestMail[] = Array.from({ length: 3 }, (_, index) => ({
      id: `m${index}`,
      subject: `Izvadak 04${index}`,
      at: `2031-03-1${index}T04:00:00Z`,
      attachments: [[`IZV_2031_03_1${index} 03_05_19_314_503.pdf`, `pdf ${index}`]],
    }))
    const byOtherApp: TestFiled[] = mails.map((_, index) => ({
      folders: ['2031-statements'],
      name: `2031-03-1${index}-statement-04${index}.pdf`,
      created: `2031-03-1${index}T06:00:00Z`,
      content: null,
    }))
    const mailbox = testMailbox(mails)

    const result = await plan([], byOtherApp, { mailbox })

    expect(mailbox.queries).toEqual([`from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:${Date.parse('2031-03-05T06:00:00Z') / 1000}`])
    expect(result.sources[0]).toMatchObject({ window: { from: Date.parse('2031-03-05T06:00:00Z'), after: 'newest' } })
    expect(planLine(result)).toBe('Nothing new, already there 3.')
  })

  it('never searches from before the mail-since day, however old the newest file', async () => {
    const mailbox = testMailbox([])

    const result = await plan([], [{ folders: ['2031-statements'], name: '2031-01-02-statement-001.pdf', created: '2031-01-02T06:00:00Z', content: null }], { mailbox })

    expect(result.sources[0]).toMatchObject({ window: { from: SINCE, after: 'since' } })
  })

  it('lists the year folders from the mail-since year before it searches, and a folder of an older year a mail names after', async () => {
    const folders = testFolders([{ folders: ['2030-statements'], name: '2030-12-31-statement-099.pdf', created: '2031-01-01T06:00:00Z', content: null }])
    const mailbox = testMailbox([
      { id: 'late', subject: 'Izvadak 099', at: '2031-01-01T05:00:00Z', attachments: [['IZV_2030_12_31 03_05_19_314_503.pdf', 'pdf 099']] },
      { id: 'new', subject: 'Izvadak 001', at: '2031-01-02T05:00:00Z', attachments: [['IZV_2031_01_02 03_05_19_314_503.pdf', 'pdf 001']] },
    ])

    const result = await plan([], [], { folders, mailbox })

    expect(folders.asked).toEqual([[['2031-statements']], [['2030-statements']]])
    expect(targets(result.sources[0]).map((target) => target.split(' ')[0])).toEqual(['already', 'filed'])
  })

  it('stops the step when Gmail still asks to slow down, with a plain sentence and none of Google’s answer', async () => {
    const failure = plan([], [], { mailbox: testMailbox([], 500, true) })

    await expect(failure).rejects.toBeInstanceOf(MailRateLimited)
    await expect(failure).rejects.toThrow(/^Gmail asked us to slow down\. Sync again in a minute\.$/)
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
    expect(targets(sources[0]).map((target) => target.split('/').at(-1))).toEqual([
      '2031-03-10-statement-001.pdf',
      '2031-03-11-statement-002.pdf',
      '2031-03-12-statement-003.pdf',
      '2031-03-13-statement-004.pdf',
      '2031-03-14-statement-005.pdf',
    ])
  })

  it('lets a source that fails leave the others running, and says both in its line', async () => {
    const failing: MailSource = {
      id: 'broken',
      label: 'VAT returns',
      duplicates: 'correction',
      terms: () => ({ kind: 'on', terms: { senders: ['office@accountant.example.com'], subject: 'PDV za', folder: ['finance', 'vat'] } }),
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
    expect(planLine(result)).toBe('Filed 1. VAT returns: Gmail did not answer.')
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

  it('reads a PDF’s bytes from Gmail only to compare or file them, never to name it', async () => {
    const mailbox = testMailbox([{ id: 'pdf', subject: 'Izvadak 042', at: '2031-03-12T04:00:00Z', attachments: [['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf']] }])

    await plan([], [{ folders: ['2031-statements'], name: '2031-03-12-statement-042.pdf', created: '2031-03-12T05:00:00Z', content: null }], { mailbox })

    expect(mailbox.downloads).toEqual([])
  })
})

describe('filing the bank statements', () => {
  const PAIR: TestMail = {
    id: '18c2f4a9d7e01b3c',
    subject: 'Izvadak 042, Example Studio d.o.o.',
    at: '2031-03-12T04:00:00Z',
    attachments: [
      ['IZV_2031_03_12 03_05_19_314_503.pdf', 'pdf 042'],
      ['IZV_2031_03_12 03_05_19_314_503.xml', CREDIT],
    ],
  }
  const NEXT: TestMail = { id: '18c3a1b2c3d4e5f6', subject: 'Izvadak 043, Example Studio d.o.o.', at: '2031-03-13T04:00:00Z', attachments: [['IZV_2031_03_13 03_05_19_314_503.pdf', 'pdf 043']] }

  it('makes each new file in its year folder with its bytes, carrying the source, the mail’s id and the mail’s date', async () => {
    const folders = testFolders([])

    const result = await plan([NEXT, PAIR], [], { folders })

    expect(folders.created).toEqual([
      {
        folder: FOLDER,
        below: ['2031-statements'],
        name: '2031-03-12-statement-042.pdf',
        properties: { 'kuna-mail': 'statements', 'kuna-mail-id': '18c2f4a9d7e01b3c', 'kuna-mail-date': '2031-03-12T04:00:00.000Z' },
        content: 'pdf 042',
      },
      {
        folder: FOLDER,
        below: ['2031-statements'],
        name: '2031-03-12-statement-042-main.xml',
        properties: { 'kuna-mail': 'statements', 'kuna-mail-id': '18c2f4a9d7e01b3c', 'kuna-mail-date': '2031-03-12T04:00:00.000Z' },
        content: CREDIT,
      },
      {
        folder: FOLDER,
        below: ['2031-statements'],
        name: '2031-03-13-statement-043.pdf',
        properties: { 'kuna-mail': 'statements', 'kuna-mail-id': '18c3a1b2c3d4e5f6', 'kuna-mail-date': '2031-03-13T04:00:00.000Z' },
        content: 'pdf 043',
      },
    ])
    expect(planLine(result)).toBe('Filed 3.')
    expect(hasProblem(result)).toBe(false)
  })

  it('files what the folder lacks and nothing it holds, and a run after that files nothing new, searching from a week before the newest mail it filed', async () => {
    const folders = testFolders([{ folders: ['2031-statements'], name: '2031-03-12-statement-042.pdf', created: '2031-03-12T05:00:00Z', content: null }])
    const mailbox = testMailbox([PAIR, NEXT])

    const first = await plan([], [], { folders, mailbox })
    const again = await plan([], [], { folders, mailbox })

    expect(targets(first.sources[0]).map((target) => target.split(' ')[0])).toEqual(['already', 'filed', 'filed'])
    expect(folders.created.map((file) => file.name)).toEqual(['2031-03-12-statement-042-main.xml', '2031-03-13-statement-043.pdf'])
    expect(planLine(again)).toBe('Nothing new, already there 3.')
    expect(mailbox.queries.at(-1)).toBe(`from:(statements@bank.example.com) subject:"Izvadak" has:attachment after:${Date.parse('2031-03-06T04:00:00Z') / 1000}`)
  })

  it('files the others when one upload fails, names the one in the line, and lists why', async () => {
    const folders = testFolders([], { refuse: (name) => (name.endsWith('042.pdf') ? new Error('Drive did not take the upload') : null) })

    const result = await plan([PAIR, NEXT], [], { folders })

    expect(targets(result.sources[0])).toEqual([
      'not-filed work/bank/statements/2031-statements/2031-03-12-statement-042.pdf',
      'filed work/bank/statements/2031-statements/2031-03-12-statement-042-main.xml',
      'filed work/bank/statements/2031-statements/2031-03-13-statement-043.pdf',
    ])
    expect(entriesOf(result.sources[0])[0]).toMatchObject({ kind: 'not-filed', reason: 'Drive did not take the upload' })
    expect(planLine(result)).toBe('Filed 2. Bank statements: 2031-03-12-statement-042.pdf was not filed.')
    expect(hasProblem(result)).toBe(true)
  })

  it('files the rest on the next run after Google turned the token away mid-filing, and none twice', async () => {
    let uploads = 0
    const folders = testFolders([], {
      refuse: () => {
        uploads += 1
        return uploads === 2 ? new GoogleApiError('https://www.googleapis.com/upload/drive/v3/files', 401, '{"error":{"code":401}}') : null
      },
    })
    const mailbox = testMailbox([PAIR, NEXT])

    await expect(plan([], [], { folders, mailbox })).rejects.toBeInstanceOf(GoogleApiError)
    const again = await plan([], [], { folders, mailbox })

    expect(targets(again.sources[0]).map((target) => target.split(' ')[0])).toEqual(['already', 'filed', 'filed'])
    expect(folders.created.map((file) => file.name)).toEqual(['2031-03-12-statement-042.pdf', '2031-03-12-statement-042-main.xml', '2031-03-13-statement-043.pdf'])
  })

  it('files the rest on the next run after the page lost the network for an upload, as a phone sent to the background does', async () => {
    let offline = false
    const folders = testFolders([], { refuse: (name) => (offline && name.includes('043') ? new TypeError('NetworkError when attempting to fetch resource.') : null) })
    const mailbox = testMailbox([PAIR, NEXT])

    offline = true
    const interrupted = await plan([], [], { folders, mailbox })
    offline = false
    const again = await plan([], [], { folders, mailbox })

    expect(targets(interrupted.sources[0]).map((target) => target.split(' ')[0])).toEqual(['filed', 'filed', 'not-filed'])
    expect(targets(again.sources[0]).map((target) => target.split(' ')[0])).toEqual(['already', 'already', 'filed'])
    expect(folders.created.map((file) => file.name)).toEqual(['2031-03-12-statement-042.pdf', '2031-03-12-statement-042-main.xml', '2031-03-13-statement-043.pdf'])
  })

  it('holds mail more than a week newer than an upload that failed, so the next run still searches back to that mail and files both', async () => {
    const LATER: TestMail = { id: '18d0aa11bb22cc33', subject: 'Izvadak 060, Example Studio d.o.o.', at: '2031-04-02T04:00:00Z', attachments: [['IZV_2031_04_02 03_05_19_314_503.pdf', 'pdf 060']] }
    let failing = true
    const folders = testFolders([], { refuse: (name) => (failing && name === '2031-03-12-statement-042.pdf' ? new Error('Drive did not take the upload') : null) })
    const mailbox = testMailbox([PAIR, NEXT, LATER])

    const first = await plan([], [], { folders, mailbox })
    failing = false
    const again = await plan([], [], { folders, mailbox })

    expect(targets(first.sources[0]).map((target) => target.split(' ')[0])).toEqual(['not-filed', 'filed', 'filed', 'not-filed'])
    expect(entriesOf(first.sources[0])[3]).toMatchObject({ kind: 'not-filed', reason: 'It waits until 2031-03-12-statement-042.pdf is filed, so the next sync still searches back to that mail' })
    expect(planLine(first)).toBe('Filed 2. Bank statements: 2031-03-12-statement-042.pdf and 2031-04-02-statement-060.pdf were not filed.')
    expect(targets(again.sources[0]).map((target) => target.split(' ')[0])).toEqual(['filed', 'already', 'already', 'filed'])
    expect(folders.created.map((file) => file.name)).toEqual(['2031-03-12-statement-042-main.xml', '2031-03-13-statement-043.pdf', '2031-03-12-statement-042.pdf', '2031-04-02-statement-060.pdf'])
  })

  it('says nothing was filed when every upload failed', async () => {
    const folders = testFolders([], { refuse: () => new Error('Drive did not take the upload') })

    const result = await plan([NEXT], [], { folders })

    expect(planLine(result)).toBe('Nothing filed. Bank statements: 2031-03-13-statement-043.pdf was not filed.')
  })
})

describe('a blank mail-since day at the turn of the year', () => {
  it('still finds a December mail on 3 January, since it lists last year’s folder and starts from the newest file there', async () => {
    const today = '2032-01-03' as CivilDate
    const since = mailSinceDefault(today)
    const mailbox = testMailbox([{ id: 'dec30', subject: 'Izvadak 250', at: '2031-12-30T05:00:00Z', attachments: [['IZV_2031_12_30 03_05_19_314_503.pdf', 'pdf 250']] }])
    const folders = testFolders([{ folders: ['2031-statements'], name: '2031-12-29-statement-249.pdf', created: '2031-12-29T06:00:00Z', content: null, filedFrom: '2031-12-29T05:00:00Z' }])

    const found = await fileMail({
      open: async () => ({ mailbox, folders }),
      sources: [STATEMENTS],
      workbook: books(),
      sinceStart: startOfDayIn(since, 'Europe/Zagreb'),
      years: yearsSince(since, today),
      hash: hashOf,
      report: () => {},
    })

    expect(since).toBe('2031-01-01')
    expect(folders.asked[0]).toEqual([['2031-statements'], ['2032-statements']])
    expect(mailbox.reads).toEqual(['dec30'])
    expect(targets(found.sources[0])).toEqual(['filed work/bank/statements/2031-statements/2031-12-30-statement-250.pdf'])
  })
})

describe('the sources at the same time', () => {
  /** A source that files each attachment of the mail whose subject holds its phrase into its year folder, named by the mail, reading the attachment's bytes to name it. */
  function readingSource(id: string, label: string, subject: string): MailSource {
    return {
      id,
      label,
      duplicates: 'correction',
      terms: () => ({ kind: 'on', terms: { senders: ['office@accountant.example.com'], subject, folder: ['finance', id] } }),
      name: (message, terms, reading) =>
        Promise.all(
          message.attachments.map(async (attachment, index): Promise<AttachmentNaming> => {
            await reading.bytes(attachment)
            return { kind: 'named', attachment, folders: [yearFolderName(2031, terms.folder)], name: `${message.id}-${index}.pdf`, redelivery: null }
          }),
        ),
    }
  }

  const PAYROLL = readingSource('payroll', 'Payroll', 'Plaća za')
  const VAT = readingSource('vat', 'VAT returns', 'PDV za')

  /** A mail of the day in March 2031, of a subject, with one attachment, or as many as `attachments` says. */
  function mail(id: string, subject: string, day: number, attachments = 1): TestMail {
    return { id, subject, at: `2031-03-${String(day).padStart(2, '0')}T08:00:00Z`, attachments: Array.from({ length: attachments }, (_, index) => [`file ${index}.pdf`, `${id} ${index}`] as const) }
  }

  function pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
  }

  /** A promise the test opens once something happened, such as another source's upload. */
  function gate(): { readonly opened: Promise<void>; open(): void } {
    let open = (): void => {}
    const opened = new Promise<void>((resolve) => {
      open = resolve
    })
    return { opened, open: () => open() }
  }

  /** The mailbox with each call answered once what `before` gives it ends. It notes each call as it reaches the mailbox, and the most calls it had in flight at once. */
  function timedMailbox(mailbox: Mailbox, before: (call: string) => Promise<void>): Mailbox & { readonly calls: string[]; most(): number } {
    const calls: string[] = []
    let inFlight = 0
    let most = 0
    async function timed<Result>(call: string, answer: () => Promise<Result>): Promise<Result> {
      calls.push(call)
      inFlight += 1
      most = Math.max(most, inFlight)
      try {
        await before(call)
        return await answer()
      } finally {
        inFlight -= 1
      }
    }
    return {
      calls,
      most: () => most,
      search: (query, pageToken) => timed(`search ${/subject:"([^"]*)"/.exec(query)?.[1] ?? ''}`, () => mailbox.search(query, pageToken)),
      message: (id) => timed(`message ${id}`, () => mailbox.message(id)),
      attachment: (messageId, attachmentId) => timed(`attachment ${attachmentId}`, () => mailbox.attachment(messageId, attachmentId)),
    }
  }

  /** Each made file as its source folder's last name and its own name, in the order it was made. */
  function made(folders: ReturnType<typeof testFolders>): string[] {
    return folders.created.map((file) => `${file.folder.at(-1)} ${file.name}`)
  }

  it('runs the sources at the same time, says each one still running in a line that breaks only between them, and lists them in their order whichever ends first', async () => {
    const mails = [mail('payroll-03', 'Plaća za 2/2031', 5), mail('vat-03', 'PDV za 2/2031', 14)]
    const vatFiled = gate()
    // The payroll's search answers only once the VAT return is filed, which it never would one source at a time.
    const mailbox = timedMailbox(testMailbox(mails), (call) => (call === 'search Plaća za' ? vatFiled.opened.then(() => pause(0)) : pause(0)))
    const folders = testFolders([], {
      refuse: (name) => {
        if (name.startsWith('vat')) vatFiled.open()
        return null
      },
    })
    const reports: string[] = []

    const result = await plan([], [], { sources: [PAYROLL, VAT], mailbox, folders, reports })

    expect(made(folders)).toEqual(['vat vat-03-0.pdf', 'payroll payroll-03-0.pdf'])
    expect(result.sources.map((source) => source.id)).toEqual(['payroll', 'vat'])
    expect(reports.map((line) => line.replaceAll('\u00a0', ' '))).toEqual([
      'Payroll: searching',
      'Payroll: searching · VAT returns: searching',
      'Payroll: searching · VAT returns: filing 1 of 1',
      'Payroll: searching',
      'Payroll: filing 1 of 1',
    ])
    expect(reports[1]).toBe('Payroll:\u00a0searching\u00a0· VAT\u00a0returns:\u00a0searching')
    expect(planLine(result)).toBe('Filed 2.')
  })

  it('never has more than ten Gmail calls in flight over all its sources, and downloads each attachment once', async () => {
    const mails = ['Plaća za', 'PDV za', 'Račun za'].flatMap((subject, source) => Array.from({ length: 15 }, (_, index) => mail(`${source}-${index}`, `${subject} 2/2031`, index + 1, 2)))
    const mailbox = testMailbox(mails)
    const timed = timedMailbox(mailbox, (call) => pause(call.length % 4))
    const invoices = readingSource('invoices', "Accountant's invoices", 'Račun za')

    const result = await plan([], [], { sources: [PAYROLL, VAT, invoices], mailbox: timed })

    expect(timed.most()).toBe(10)
    expect(planLine(result)).toBe('Filed 90.')
    expect(mailbox.downloads).toHaveLength(90)
  })

  it('files a source’s mail oldest first however its reads end, while another source files beside it', async () => {
    const mails = [
      mail('vat-a', 'PDV za 1/2031', 2),
      mail('vat-b', 'PDV za 1/2031', 9),
      mail('vat-c', 'PDV za 1/2031', 20),
      mail('payroll-a', 'Plaća za 1/2031', 3),
      mail('payroll-b', 'Plaća za 1/2031', 12),
    ]
    // Newer mail is read sooner, so its naming ends first.
    const mailbox = timedMailbox(testMailbox(mails), (call) => pause(call.startsWith('message') ? 30 - new Date(mails.find((candidate) => call === `message ${candidate.id}`)!.at).getUTCDate() : 0))
    const folders = testFolders([])

    const result = await plan([], [], { sources: [PAYROLL, VAT], mailbox, folders })

    expect(made(folders).filter((file) => file.startsWith('vat'))).toEqual(['vat vat-a-0.pdf', 'vat vat-b-0.pdf', 'vat vat-c-0.pdf'])
    expect(made(folders).filter((file) => file.startsWith('payroll'))).toEqual(['payroll payroll-a-0.pdf', 'payroll payroll-b-0.pdf'])
    expect(targets(result.sources[1]).map((target) => target.split('/').at(-1))).toEqual(['vat-a-0.pdf', 'vat-b-0.pdf', 'vat-c-0.pdf'])
  })

  it('holds a source’s mail more than a week newer than its failed upload while the other source files all of its own', async () => {
    const mails = [mail('vat-a', 'PDV za 1/2031', 2), mail('vat-b', 'PDV za 1/2031', 20), mail('payroll-a', 'Plaća za 1/2031', 3), mail('payroll-b', 'Plaća za 1/2031', 21)]
    const folders = testFolders([], { refuse: (name) => (name === 'vat-a-0.pdf' ? new Error('Drive did not take the upload') : null) })

    const result = await plan([], [], { sources: [PAYROLL, VAT], mailbox: timedMailbox(testMailbox(mails), () => pause(0)), folders })

    expect(entriesOf(result.sources[1]).map((entry) => entry.kind)).toEqual(['not-filed', 'not-filed'])
    expect(entriesOf(result.sources[1])[1]).toMatchObject({ reason: 'It waits until vat-a-0.pdf is filed, so the next sync still searches back to that mail' })
    expect(made(folders)).toEqual(['payroll payroll-a-0.pdf', 'payroll payroll-b-0.pdf'])
    expect(planLine(result)).toBe('Filed 2. VAT returns: vat-a-0.pdf and vat-b-0.pdf were not filed.')
  })

  it('stops every source’s next call once Gmail still asks one to slow down, and throws that', async () => {
    const mails = [mail('payroll-a', 'Plaća za 1/2031', 3), mail('vat-a', 'PDV za 1/2031', 2)]
    const working = testMailbox(mails)
    const slowedDown = gate()
    const limited: Mailbox = {
      ...working,
      search: async (query, page) => {
        if (query.includes('Plaća za')) {
          slowedDown.open()
          throw new MailRateLimited()
        }
        return working.search(query, page)
      },
    }
    const mailbox = timedMailbox(limited, (call) => (call === 'search PDV za' ? slowedDown.opened.then(() => pause(0)) : pause(0)))
    const folders = testFolders([])

    await expect(plan([], [], { sources: [PAYROLL, VAT], mailbox, folders })).rejects.toBeInstanceOf(MailRateLimited)
    expect(mailbox.calls).toEqual(['search Plaća za', 'search PDV za'])
    expect(folders.created).toEqual([])
  })

  it('stops every source’s next call once Google turns the token away for one source’s upload, and throws that', async () => {
    const mails = [mail('payroll-a', 'Plaća za 1/2031', 3), mail('vat-a', 'PDV za 1/2031', 2)]
    const turnedAway = gate()
    const mailbox = timedMailbox(testMailbox(mails), (call) => (call === 'search PDV za' ? turnedAway.opened.then(() => pause(0)) : pause(0)))
    const folders = testFolders([], {
      refuse: (name) => {
        if (!name.startsWith('payroll')) return null
        turnedAway.open()
        return new GoogleApiError('https://www.googleapis.com/upload/drive/v3/files', 401, '{"error":{"code":401}}')
      },
    })

    await expect(plan([], [], { sources: [PAYROLL, VAT], mailbox, folders })).rejects.toBeInstanceOf(GoogleApiError)
    expect(mailbox.calls).toEqual(['search Plaća za', 'search PDV za', 'message payroll-a', 'attachment payroll-a/0'])
    expect(folders.created).toEqual([])
  })
})
