import { describe, expect, it } from 'vitest'

import { planLine, planMail } from '../src/features/mail/application/mailFiling'
import type { PlanEntry } from '../src/features/mail/application/mailFiling'
import type { MailMessage } from '../src/features/mail/domain/mailSource'
import { ACCOUNTANT_MAIL_SOURCES } from '../src/packs/hr-doo/application/accountantMailSources'
import { invoiceNamings, payrollMonthOf, payrollNamings, vatNamings, vatPeriodOf } from '../src/packs/hr-doo/domain/accountant/accountantMailFiling'
import { COMPANY_FACT_SETTINGS } from '../src/packs/hr-doo/domain/companyFacts'
import type { CompanyFacts } from '../src/packs/hr-doo/domain/companyFacts'
import type { Employee } from '../src/packs/hr-doo/domain/employees/employees'
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
    const namings = payrollNamings(
      mail('RE: Plaća za 9/2026', ['Example plaća 9 2026.xlsx', 'IP1 obrazac 9 2026.pdf', 'UN0926.xml', 'Platni nalog_Example 9 2026.pdf']),
      'Plaća za',
      PAYROLL,
      [ana],
    )

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
    const late = invoiceNamings(mail('Račun za 8/2026', ['142-1-1_Example.pdf', 'Opis.pdf'], '2026-09-30T22:30:00Z'), INVOICES)

    expect(named(late)).toEqual(['2026-incoming-invoices/2026-10/2026-10-01-accounting.pdf', 'unmatched Opis.pdf'])
  })
})

const FACTS: CompanyFacts = {
  ...COMPANY_FACT_SETTINGS.defaults,
  accountantMailFrom: ['office@accountant.example.com'],
  payrollMailSubject: 'Plaća za',
  vatMailSubject: 'PDV za',
  invoicesMailSubject: '',
  payrollFolder: PAYROLL,
  vatReturnsFolder: VAT,
  incomingInvoicesFolder: INVOICES,
}

async function planVat(mails: readonly TestMail[], filed: readonly TestFiled[], facts: CompanyFacts = FACTS) {
  const mailbox = testMailbox(mails)
  const plan = await planMail({
    mailbox,
    folders: testFolders(filed),
    sources: ACCOUNTANT_MAIL_SOURCES,
    workbook: exampleStudio({ companyFacts: facts, employees: [director()] }),
    sinceStart: Date.parse('2025-12-31T23:00:00Z'),
    hash: hashOf,
    report: () => {},
  })
  const vat = plan.sources.find((source) => source.id === 'hr-doo.vat-returns')
  const entries: readonly PlanEntry[] = vat?.kind === 'planned' ? vat.entries : []
  return { plan, mailbox, kinds: entries.map((entry) => entry.kind), entries }
}

const AUGUST = (at: string, content: string): TestMail => ({ id: `vat-${at}`, subject: 'RE: PDV za 8/2026', at, attachments: [['PDV 8 2026_Example.xlsx', content]] })
const FILED_AUGUST = (content: string | null, filedByApp = false): TestFiled => ({ folders: ['2026-vat-returns'], name: '2026-08-pdv.xlsx', created: '2026-09-15T10:00:00Z', content, filedByApp })

describe("the accountant's resends", () => {
  it('runs the kinds whose subject is set, and none without the sender', async () => {
    const { plan } = await planVat([], [])
    const off = await planVat([], [], { ...FACTS, accountantMailFrom: [] })

    expect(plan.sources.map((source) => source.id)).toEqual(['hr-doo.payroll', 'hr-doo.vat-returns'])
    expect(off.plan.sources).toEqual([])
  })

  it('takes a file filed after the mail came as already there, without reading the mail’s bytes', async () => {
    const { kinds, mailbox } = await planVat([AUGUST('2026-09-14T12:00:00Z', 'v1')], [FILED_AUGUST('v1')])

    expect(kinds).toEqual(['already'])
    expect(mailbox.downloads).toEqual([])
  })

  it('compares a newer mail’s bytes with the filed file’s SHA-256: the same bytes are already there, other bytes are a correction', async () => {
    const same = await planVat([AUGUST('2026-10-02T12:00:00Z', 'v1')], [FILED_AUGUST('v1')])
    const resend = await planVat([AUGUST('2026-10-02T12:00:00Z', 'v2')], [FILED_AUGUST('v1')])
    const ours = await planVat([AUGUST('2026-10-02T12:00:00Z', 'v2')], [FILED_AUGUST('v1', true)])

    expect(same.kinds).toEqual(['already'])
    expect(resend.entries).toMatchObject([{ kind: 'correction', filedByApp: false, path: [...VAT, '2026-vat-returns'], name: '2026-08-pdv.xlsx' }])
    expect(ours.entries).toMatchObject([{ kind: 'correction', filedByApp: true }])
    expect(planLine(resend.plan)).toBe('Nothing new, 1 correction.')
  })

  it('says the bytes could not be compared when Drive gives the filed file no SHA-256', async () => {
    const { kinds, mailbox } = await planVat([AUGUST('2026-10-02T12:00:00Z', 'v2')], [FILED_AUGUST(null)])

    expect(kinds).toEqual(['unchecked'])
    expect(mailbox.downloads).toEqual([])
  })

  it('takes a resend in the same run with other bytes as a correction of the file the first mail would file, and the corrected copy as the one a later resend is compared with', async () => {
    const { entries } = await planVat([AUGUST('2026-09-14T12:00:00Z', 'v1'), AUGUST('2026-10-02T12:00:00Z', 'v2'), AUGUST('2026-10-03T12:00:00Z', 'v2')], [])

    expect(entries.map((entry) => [entry.kind, entry.mail.date])).toEqual([
      ['file', Date.parse('2026-09-14T12:00:00Z')],
      ['correction', Date.parse('2026-10-02T12:00:00Z')],
      ['already', Date.parse('2026-10-03T12:00:00Z')],
    ])
  })
})
