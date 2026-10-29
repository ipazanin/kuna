import { describe, expect, it } from 'vitest'

import { fileMail, planLine } from '../src/apps/company/mail/application/mailFiling'
import type { PlanEntry } from '../src/apps/company/mail/application/mailFiling'
import type { MailMessage } from '../src/apps/company/mail/domain/mailSource'
import { ACCOUNTANT_MAIL_SOURCES } from '../src/apps/company/packs/hr-doo/application/accountantMailSources'
import { invoiceNamings, payrollMonthOf, payrollNamings, vatNamings, vatPeriodOf } from '../src/apps/company/packs/hr-doo/domain/accountant/accountantMailFiling'
import { COMPANY_FACT_SETTINGS } from '../src/apps/company/packs/hr-doo/domain/companyFacts'
import type { CompanyFacts } from '../src/apps/company/packs/hr-doo/domain/companyFacts'
import type { Employee } from '../src/apps/company/packs/hr-doo/domain/employees/employees'
import { director } from './fixtures/employees'
import { exampleStudio } from './fixtures/exampleStudio'
import { hashOf, testFolders, testMailbox } from './fixtures/mailbox'
import type { TestFiled, TestMail } from './fixtures/mailbox'

const PAYROLL = ['work', 'company', 'payroll']
const VAT = ['work', 'company', 'vat-returns']
const INVOICES = ['work', 'company', 'incoming-invoices']

function mail(subject: string, names: readonly string[], at = '2026-10-05T08:30:00Z'): MailMessage {
  return { id: 'mail', subject, date: Date.parse(at), attachments: names.map((name, index) => ({ id: String(index), name })) }
}

/** Each naming as the file it would be, below the source folder, or what matched no rule. */
function named(namings: ReturnType<typeof payrollNamings>): string[] {
  return namings.map((naming) => (naming.kind === 'named' ? [...naming.folders, naming.name].join('/') : `unmatched ${naming.attachment.name}`))
}

describe("the accountant's subjects", () => {
  it('give the payroll month after the phrase, past RE: and FW:, with or without the Croatian characters, and never a two-digit year', () => {
    expect(payrollMonthOf('Plaća za 9/2026', 'Plaća za')).toBe('2026-09')
    expect(payrollMonthOf('RE: FW: Plaća za 10 / 2026', 'Plaća za')).toBe('2026-10')
    expect(payrollMonthOf('Placa za 9/2026', 'Plaća za')).toBe('2026-09')
    expect(payrollMonthOf('PLAĆA ZA 9/2026', 'plaća za')).toBe('2026-09')
    expect(payrollMonthOf('Plaća za 9/26', 'Plaća za')).toBeNull()
    expect(payrollMonthOf('Plaća za rujan', 'Plaća za')).toBeNull()
    expect(payrollMonthOf('Pitanje: Plaća za 9/2026', 'Plaća za')).toBeNull()
  })

  it('give the VAT period after the phrase, a two-digit year read as this century', () => {
    expect(vatPeriodOf('PDV za 8/25', 'PDV za')).toBe('2025-08')
    expect(vatPeriodOf('RE: PDV za 7/2026 - ispravak', 'PDV za')).toBe('2026-07')
    expect(vatPeriodOf('PDV za 13/2026', 'PDV za')).toBeNull()
  })
})

describe('the payroll mail', () => {
  const ana: Employee = director({ employee: 'ana', name: 'Ana Horvat' })

  it('names the salary workbook, the IP1 form and a payment order with its XML, which takes its kind from the PDF beside it, in the month’s folder', () => {
    const namings = payrollNamings(mail('RE: Plaća za 9/2026', ['Example plaća 9 2026.xlsx', 'IP1 obrazac 9 2026.pdf', 'UN0926.xml', 'Platni nalog_Example 9 2026.pdf']), 'Plaća za', PAYROLL, [ana])

    expect(named(namings)).toEqual([
      '2026-payroll/2026-09/2026-09-salary.xlsx',
      '2026-payroll/2026-09/2026-09-ip1-form-ana-horvat.pdf',
      '2026-payroll/2026-09/2026-09-payment-order-salary.xml',
      '2026-payroll/2026-09/2026-09-payment-order-salary.pdf',
    ])
  })

  it('names the documents when the accountant joins the words of a file name with underscores', () => {
    const namings = payrollNamings(
      mail('Plaća za 9/2026', ['IP1 obrazac_Ana Horvat_9 2026.pdf', 'Platni nalog_Example_9 2026.pdf', 'UN202610120001.XML', 'Example plaća_9 2026.xlsx']),
      'Plaća za',
      PAYROLL,
      [ana],
    )

    expect(named(namings)).toEqual([
      '2026-payroll/2026-09/2026-09-ip1-form-ana-horvat.pdf',
      '2026-payroll/2026-09/2026-09-payment-order-salary.pdf',
      '2026-payroll/2026-09/2026-09-payment-order-salary.xml',
      '2026-payroll/2026-09/2026-09-salary.xlsx',
    ])
  })

  it('names the rent order and its XML, and reads the salary workbook’s name with the diacritics of either kind', () => {
    const namings = payrollNamings(mail('FW: Plaća za 9/2026', ['Platni nalog za zakup 9 2026.pdf', 'UN0926Z.XML', 'EXAMPLE PLAĆA 9 2026.xlsx']), 'Plaća za', PAYROLL, [ana])

    expect(named(namings)).toEqual(['2026-payroll/2026-09/2026-09-payment-order-rent.pdf', '2026-payroll/2026-09/2026-09-payment-order-rent.xml', '2026-payroll/2026-09/2026-09-salary.xlsx'])
  })

  it('leaves an order of a kind it does not know unmatched, with its XML, rather than file it under a guess', () => {
    const namings = payrollNamings(mail('Plaća za 9/2026', ['Platni nalog za porez 9 2026.pdf', 'UN0926P.xml', 'Upute.docx']), 'Plaća za', PAYROLL, [ana])

    expect(namings.map((naming) => (naming.kind === 'unmatched' ? naming.reason : naming.name))).toEqual([
      'It is a payment order of a kind the app does not know, so it is not filed under a guess.',
      'No payment order PDF in the same mail says which order it carries.',
      'It is not a payroll document the app knows how to name.',
    ])
  })

  it('leaves every attachment unmatched when the subject names no month', () => {
    expect(named(payrollNamings(mail('Plaća', ['Example plaća 9 2026.xlsx']), 'Plaća za', PAYROLL, [ana]))).toEqual(['unmatched Example plaća 9 2026.xlsx'])
  })

  it('names the IP1 form for the employee it names, or else the only one employed that month', () => {
    const luka = director({ employee: 'luka', name: 'Luka Perić', director: false, from: '2026-06-01' })
    const form = (name: string, staff: readonly Employee[], month = '9/2026') => named(payrollNamings(mail(`Plaća za ${month}`, [name]), 'Plaća za', PAYROLL, staff))[0]

    expect(form('IP1 obrazac Peric Luka 9 2026.pdf', [ana, luka])).toBe('2026-payroll/2026-09/2026-09-ip1-form-luka-peric.pdf')
    expect(form('IP1 obrazac 3 2026.pdf', [ana, luka], '3/2026')).toBe('2026-payroll/2026-03/2026-03-ip1-form-ana-horvat.pdf')
    expect(form('IP1 obrazac 9 2026.pdf', [ana, luka])).toBe('unmatched IP1 obrazac 9 2026.pdf')
    expect(form('IP1 obrazac 9 2026.pdf', [])).toBe('unmatched IP1 obrazac 9 2026.pdf')
  })
})

describe('the VAT return and invoice mail', () => {
  it('files the VAT workbook by the period of the subject in that year’s folder, and nothing else', () => {
    expect(named(vatNamings(mail('PDV za 8/25', ['PDV 8 2025_Example.xlsx', 'Obrazac PDV.pdf']), 'PDV za', VAT))).toEqual(['2025-vat-returns/2025-08-pdv.xlsx', 'unmatched Obrazac PDV.pdf'])
  })

  it('files the invoice PDF by the day it was mailed in Croatia, whatever month the subject names', () => {
    const late = invoiceNamings(mail('Račun za 8/2026', ['142-1-1_Example.pdf', 'Opis.pdf'], '2026-09-30T22:30:00Z'), 'Račun za', INVOICES)

    expect(named(late)).toEqual(['2026-incoming-invoices/2026-10/2026-10-01-accounting.pdf', 'unmatched Opis.pdf'])
  })
})

describe("the accountant's subject words", () => {
  it('take only mail whose subject starts with them, past RE: and FW:, whatever the case and the Croatian characters, as Gmail finds them anywhere in a subject', () => {
    const invoice = (subject: string) => named(invoiceNamings(mail(subject, ['142-1-1_Example.pdf']), 'Račun za', INVOICES))

    expect(invoice('Račun za 9/2026')).toEqual(['2026-incoming-invoices/2026-10/2026-10-05-accounting.pdf'])
    expect(invoice('  RE: racun ZA 9/2026')).toEqual(['2026-incoming-invoices/2026-10/2026-10-05-accounting.pdf'])
    expect(invoice('Upit: Račun za rujan')).toEqual(['unmatched 142-1-1_Example.pdf'])
    expect(invoiceNamings(mail('Opomena, Račun za 9/2026', ['142-1-1_Example.pdf']), 'Račun za', INVOICES)).toEqual([
      { kind: 'unmatched', attachment: { id: '0', name: '142-1-1_Example.pdf' }, reason: 'The subject does not start with Račun za.' },
    ])
  })

  it('hold the payroll and VAT mail to the same rule', () => {
    expect(payrollNamings(mail('Pitanje: Plaća za 9/2026', ['Example plaća 9 2026.xlsx']), 'Plaća za', PAYROLL, [])).toMatchObject([
      { kind: 'unmatched', reason: 'The subject does not start with Plaća za.' },
    ])
    expect(vatNamings(mail('Fwd: Upit, PDV za 8/2026', ['PDV 8 2026_Example.xlsx']), 'PDV za', VAT)).toMatchObject([{ kind: 'unmatched', reason: 'The subject does not start with PDV za.' }])
    expect(payrollNamings(mail('Plaća za rujan', ['Example plaća 9 2026.xlsx']), 'Plaća za', PAYROLL, [])).toMatchObject([{ kind: 'unmatched', reason: 'The subject names no month, such as 9/2026.' }])
  })
})

const FACTS: CompanyFacts = {
  ...COMPANY_FACT_SETTINGS.defaults,
  accountantMailFrom: ['office@accountant.example.com'],
  payrollMailSync: true,
  vatMailSync: true,
  payrollMailSubject: 'Plaća za',
  vatMailSubject: 'PDV za',
  invoicesMailSubject: 'Račun za',
  payrollFolder: PAYROLL,
  vatReturnsFolder: VAT,
  incomingInvoicesFolder: INVOICES,
}

async function planVat(mails: readonly TestMail[], filed: readonly TestFiled[], facts: CompanyFacts = FACTS, folders = testFolders(filed)) {
  const mailbox = testMailbox(mails)
  let opened = 0
  const plan = await fileMail({
    open: async () => {
      opened += 1
      return { mailbox, folders }
    },
    sources: ACCOUNTANT_MAIL_SOURCES,
    workbook: exampleStudio({ companyFacts: facts, employees: [director()] }),
    sinceStart: Date.parse('2025-12-31T23:00:00Z'),
    years: [2026],
    hash: hashOf,
    report: () => {},
  })
  const vat = plan.sources.find((source) => source.id === 'hr-doo.vat-returns')
  const entries: readonly PlanEntry[] = vat?.kind === 'planned' ? vat.entries : []
  return { plan, mailbox, folders, opened, kinds: entries.map((entry) => entry.kind), entries }
}

const AUGUST = (at: string, content: string): TestMail => ({ id: `vat-${at}`, subject: 'RE: PDV za 8/2026', at, attachments: [['PDV 8 2026_Example.xlsx', content]] })
const FILED_AUGUST = (content: string | null): TestFiled => ({
  folders: ['2026-vat-returns'],
  name: '2026-08-pdv.xlsx',
  created: '2026-09-15T10:00:00Z',
  content,
})

describe("the accountant's resends", () => {
  it('runs only the kinds switched on, and makes no call for the others', async () => {
    const { plan, mailbox } = await planVat([], [])
    const off = await planVat([], [], { ...FACTS, payrollMailSync: false, vatMailSync: false })

    expect(plan.sources.map((source) => source.id)).toEqual(['hr-doo.payroll', 'hr-doo.vat-returns'])
    expect(mailbox.queries.map((query) => /subject:"([^"]*)"/.exec(query)?.[1])).toEqual(['Plaća za', 'PDV za'])
    expect(off.plan.sources).toEqual([])
    expect(off.opened).toBe(0)
  })

  it('fails a kind switched on without the sender, the subject or the folder, naming what it lacks, before any call', async () => {
    const { plan, opened } = await planVat([], [], { ...FACTS, accountantMailFrom: [], vatMailSync: false, invoicesMailSync: true, incomingInvoicesFolder: [] })

    expect(plan.sources).toEqual([
      { kind: 'failed', id: 'hr-doo.payroll', label: 'Payroll', reason: 'It is on, but has no sender on Settings, General' },
      { kind: 'failed', id: 'hr-doo.invoices', label: "Accountant's invoices", reason: 'It is on, but has no sender and no folder on Settings, General' },
    ])
    expect(planLine(plan)).toBe("Payroll: It is on, but has no sender on Settings, General. Accountant's invoices: It is on, but has no sender and no folder on Settings, General.")
    expect(opened).toBe(0)
  })

  it('files each new file of every kind switched on in its year folder, oldest mail first, with the source, the mail’s id and the mail’s date', async () => {
    const mails: TestMail[] = [
      { id: 'vat-09', subject: 'PDV za 9/26', at: '2026-10-14T12:00:00Z', attachments: [['PDV 9 2026_Example.xlsx', 'vat 9']] },
      { id: 'payroll-09', subject: 'Plaća za 9/2026', at: '2026-10-05T08:30:00Z', attachments: [['Example plaća 9 2026.xlsx', 'salary 9']] },
      { id: 'invoice-142', subject: 'Račun za 9/2026', at: '2026-10-03T08:00:00Z', attachments: [['142-1-1_Example.pdf', 'invoice 142']] },
      AUGUST('2026-09-14T12:00:00Z', 'vat 8'),
    ]

    const { folders, plan } = await planVat(mails, [], { ...FACTS, invoicesMailSync: true })

    const properties = (source: string, id: string, at: string) => ({ 'kuna-mail': source, 'kuna-mail-id': id, 'kuna-mail-date': new Date(at).toISOString() })
    expect(folders.created.map((file) => [file.folder.join('/'), file.below.join('/'), file.name, file.content, file.properties])).toEqual([
      ['work/company/payroll', '2026-payroll/2026-09', '2026-09-salary.xlsx', 'salary 9', properties('hr-doo.payroll', 'payroll-09', '2026-10-05T08:30:00Z')],
      ['work/company/vat-returns', '2026-vat-returns', '2026-08-pdv.xlsx', 'vat 8', properties('hr-doo.vat-returns', 'vat-2026-09-14T12:00:00Z', '2026-09-14T12:00:00Z')],
      ['work/company/vat-returns', '2026-vat-returns', '2026-09-pdv.xlsx', 'vat 9', properties('hr-doo.vat-returns', 'vat-09', '2026-10-14T12:00:00Z')],
      ['work/company/incoming-invoices', '2026-incoming-invoices/2026-10', '2026-10-03-accounting.pdf', 'invoice 142', properties('hr-doo.invoices', 'invoice-142', '2026-10-03T08:00:00Z')],
    ])
    expect(planLine(plan)).toBe('Filed 4.')
  })

  it('names an upload that failed in the line, and holds mail more than a week newer, so the next sync still searches back to it', async () => {
    const mails: TestMail[] = [AUGUST('2026-09-14T12:00:00Z', 'vat 8'), { id: 'vat-09', subject: 'PDV za 9/26', at: '2026-10-14T12:00:00Z', attachments: [['PDV 9 2026_Example.xlsx', 'vat 9']] }]
    const folders = testFolders([], { refuse: (name) => (name === '2026-08-pdv.xlsx' ? new Error('Drive did not take the upload') : null) })

    const { entries, plan } = await planVat(mails, [], FACTS, folders)

    expect(entries).toMatchObject([
      { kind: 'not-filed', name: '2026-08-pdv.xlsx', reason: 'Drive did not take the upload' },
      { kind: 'not-filed', name: '2026-09-pdv.xlsx', reason: 'It waits until 2026-08-pdv.xlsx is filed, so the next sync still searches back to that mail' },
    ])
    expect(planLine(plan)).toBe('Nothing filed. VAT returns: 2026-08-pdv.xlsx and 2026-09-pdv.xlsx were not filed.')
    expect(folders.created).toEqual([])
  })

  it('takes a file filed after the mail came as already there, without reading the mail’s bytes', async () => {
    const { kinds, mailbox } = await planVat([AUGUST('2026-09-14T12:00:00Z', 'v1')], [FILED_AUGUST('v1')])

    expect(kinds).toEqual(['already'])
    expect(mailbox.downloads).toEqual([])
  })

  it('compares a newer mail’s bytes with the filed file’s SHA-256: the same bytes are already there, other bytes are a correction', async () => {
    const same = await planVat([AUGUST('2026-10-02T12:00:00Z', 'v1')], [FILED_AUGUST('v1')])
    const resend = await planVat([AUGUST('2026-10-02T12:00:00Z', 'v2')], [FILED_AUGUST('v1')])

    expect(same.kinds).toEqual(['already'])
    expect(resend.entries).toMatchObject([{ kind: 'correction', path: [...VAT, '2026-vat-returns'], name: '2026-08-pdv.xlsx' }])
    expect(planLine(resend.plan)).toBe('Nothing new, 1 correction.')
  })

  it('says the bytes could not be compared when Drive gives the filed file no SHA-256', async () => {
    const { kinds, mailbox } = await planVat([AUGUST('2026-10-02T12:00:00Z', 'v2')], [FILED_AUGUST(null)])

    expect(kinds).toEqual(['unchecked'])
    expect(mailbox.downloads).toEqual([])
  })

  it('takes a resend in the same run with other bytes as a correction of the file the first mail filed, and the corrected copy as the one a later resend is compared with', async () => {
    const { entries, folders } = await planVat([AUGUST('2026-09-14T12:00:00Z', 'v1'), AUGUST('2026-10-02T12:00:00Z', 'v2'), AUGUST('2026-10-03T12:00:00Z', 'v2')], [])

    expect(entries.map((entry) => [entry.kind, entry.mail.date])).toEqual([
      ['filed', Date.parse('2026-09-14T12:00:00Z')],
      ['correction', Date.parse('2026-10-02T12:00:00Z')],
      ['already', Date.parse('2026-10-03T12:00:00Z')],
    ])
    expect(folders.created.map((file) => file.content)).toEqual(['v1'])
  })
})
