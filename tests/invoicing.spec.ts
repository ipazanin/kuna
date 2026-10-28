import { describe, expect, it } from 'vitest'

import { expectedInvoices } from '../src/apps/company/billingPlan/domain/expectedInvoices'
import { newInvoiceDates } from '../src/apps/company/invoicing/domain/invoiceDates'
import { invoiceProblems } from '../src/apps/company/invoicing/domain/invoiceDocument'
import { DEFAULT_FILE_PATH, filePathProblem, filingPathOf, pathInWords } from '../src/apps/company/invoicing/domain/invoiceFiling'
import { linesTotal, plannedLines, registerItemOf } from '../src/apps/company/invoicing/domain/invoiceLines'
import { DEFAULT_MAIL_BODY, filledMail, gmailComposeUrl, mailTemplateProblem, monthInLanguage } from '../src/apps/company/invoicing/domain/invoiceMail'
import { DEFAULT_NUMBER_PATTERN, nextInvoiceNumber, numberPatternProblem, numberTaken } from '../src/apps/company/invoicing/domain/invoiceNumber'
import { rawInvoiceMessage } from '../src/apps/company/invoicing/infrastructure/invoiceMessage'
import { DEFAULT_SETTINGS, parseSettings, settingsErrors } from '../src/apps/company/settings/domain/settings'
import { CLIENT_RECORDS, SETTING_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { Client } from '../src/apps/company/workbook/domain/workbook'
import { NO_CLIENT_INVOICING } from '../src/apps/company/workbook/domain/workbook'
import { readClients } from '../src/apps/company/workbook/domain/clientsReading'
import { CORE_TABS, recordsOfRows } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { invoiceOf, planRow } from './fixtures/billingPlan'
import { civil, euros } from './fixtures/ledger'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

/** An invented register of the same shape as a real one: a first part month, one invoice a month, a bonus month, and one issued early for the next month's work. */
const REGISTER = [
  { number: '1-1-25', issued: '2025-06-30', due: '2025-07-30', from: '2025-06-01', to: '2025-06-30' },
  { number: '2-1-25', issued: '2025-07-31', due: '2025-08-31', from: '2025-07-01', to: '2025-07-31' },
  { number: '3-1-25', issued: '2025-08-31', due: '2025-09-30', from: '2025-08-01', to: '2025-08-31' },
  { number: '4-1-25', issued: '2025-12-20', due: '2026-01-20', from: '2025-12-01', to: '2025-12-31' },
  { number: '1-1-26', issued: '2026-01-20', due: '2026-02-20', from: '2026-01-01', to: '2026-01-31' },
  { number: '2-1-26', issued: '2026-02-19', due: '2026-03-19', from: '2026-02-01', to: '2026-02-28' },
  { number: '3-1-26', issued: '2026-03-31', due: '2026-04-30', from: '2026-03-01', to: '2026-03-31' },
  { number: '4-1-26', issued: '2026-04-26', due: '2026-05-26', from: '2026-04-01', to: '2026-04-30' },
  { number: '5-1-26', issued: '2026-05-31', due: '2026-06-30', from: '2026-05-01', to: '2026-05-31' },
] as const

describe('invoice numbers and dates, as the generator set them', () => {
  it('reproduces the number, due date, delivery period and file of every invoice on a register', () => {
    REGISTER.forEach((row, index) => {
      const before = REGISTER.slice(0, index).map((earlier) => ({ number: earlier.number, issued: civil(earlier.issued) }))
      const dates = newInvoiceDates(civil(row.issued))
      expect(nextInvoiceNumber(DEFAULT_NUMBER_PATTERN, civil(row.issued), before)).toBe(row.number)
      expect(dates).toEqual({ due: row.due, periodFrom: row.from, periodTo: row.to })
      expect(pathInWords(filingPathOf(DEFAULT_FILE_PATH, { issued: civil(row.issued), client: 'north', number: row.number }))).toBe(
        `${row.issued.slice(0, 4)}/${row.issued.slice(0, 7)}/${row.issued.slice(0, 7)}-north-invoice.pdf`,
      )
    })
  })

  it('restarts the sequence each year and passes over numbers the pattern does not describe', () => {
    const invoices = [
      { number: '7-1-26', issued: civil('2026-07-31') },
      { number: 'LL-003', issued: civil('2026-08-14') },
      { number: '12-1-25', issued: civil('2025-12-31') },
    ]
    expect(nextInvoiceNumber(DEFAULT_NUMBER_PATTERN, civil('2026-10-21'), invoices)).toBe('8-1-26')
    expect(nextInvoiceNumber(DEFAULT_NUMBER_PATTERN, civil('2027-01-20'), invoices)).toBe('1-1-27')
    expect(nextInvoiceNumber('INV-{yyyy}-{n}', civil('2026-10-21'), [{ number: 'INV-2026-4', issued: civil('2026-03-01') }])).toBe('INV-2026-5')
    expect(nextInvoiceNumber('{n}', civil('2027-02-01'), [{ number: '9', issued: civil('2026-11-01') }])).toBe('1')
  })

  it('keeps each number once across clients, and refuses a pattern without the sequence', () => {
    expect(numberTaken(' 7-1-26', [{ number: '7-1-26' }])).toBe(true)
    expect(numberPatternProblem('{n}-1-{yy}')).toBeNull()
    expect(numberPatternProblem('INV-{yy}')).toBe('the pattern needs {n}, the sequence, exactly once')
    expect(numberPatternProblem('{n}-{month}')).toBe('{month} is not one of {n}, {yy}, {yyyy}')
  })

  it('clamps the due date to the next month’s last day, as addOneMonth does', () => {
    expect(newInvoiceDates(civil('2026-01-31')).due).toBe('2026-02-28')
    expect(newInvoiceDates(civil('2028-01-30')).due).toBe('2028-02-29')
  })
})

describe('the file path', () => {
  it('fills the pattern from the issue date, the client and the number', () => {
    expect(filingPathOf('{yyyy}/{client}/{number}.pdf', { issued: civil('2026-10-21'), client: 'north', number: '10/1/26' })).toEqual({ folders: ['2026', 'north'], fileName: '10-1-26.pdf' })
  })

  it('names a PDF and only the words it fills in', () => {
    expect(filePathProblem(DEFAULT_FILE_PATH)).toBeNull()
    expect(filePathProblem('{yyyy}/invoice.txt')).toBe('the path ends in a file name such as {yyyy}-{mm}-{client}-invoice.pdf')
    expect(filePathProblem('{yyyy}//x.pdf')).toBe('a folder name between two slashes is blank')
    expect(filePathProblem('{year}/x.pdf')).toBe('{year} is not one of {yyyy}, {yy}, {mm}, {client}, {number}')
  })
})

describe('invoice lines', () => {
  const plan = [
    planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'September fee'),
    planRow('Subscription', '2026-09-30', 200, 'north', ''),
    planRow('Monthly Fee', '2026-10-31', 5000, 'north', 'October fee'),
    planRow('Monthly Fee', '2026-11-30', 5000, 'north', 'November fee'),
    planRow('Workshop', '2026-10-15', 900, 'south', 'Workshop'),
  ]

  it('start from the client’s open plan rows up to the end of the issue month', () => {
    const expected = expectedInvoices(plan, [invoiceOf('9-1-26', 5000, '2026-09-25')])
    const lines = plannedLines(expected, 'north', civil('2026-10-21'))
    expect(lines).toEqual([
      { description: 'Subscription', amount: euros(200) },
      { description: 'October fee', amount: euros(5000) },
    ])
    expect(linesTotal(lines)).toBe(euros(5200))
    expect(registerItemOf(lines)).toBe('Subscription; October fee')
  })
})

describe('what keeps an invoice from being made', () => {
  const client: Client = { slug: 'north', name: 'North Ltd', ibans: [], invoicing: { ...NO_CLIENT_INVOICING, address: '1 Road', reverseCharge: true } }
  const issuer = { ...DEFAULT_SETTINGS.invoicing, name: 'Example Studio', address: 'Street 1', vatId: 'HR1', iban: 'HR6212345670000000001', place: 'Split', signatory: 'Ana' }
  const line = { description: 'Work', amount: euros(100) }

  it('needs the issuer’s details, the client’s address and reverse charge, and lines above zero', () => {
    expect(invoiceProblems(issuer, client, [line])).toEqual([])
    expect(invoiceProblems({ ...issuer, vatId: '', place: '' }, client, [line])).toEqual(['The invoice terms on Invoicing, Clients need your VAT ID, the place of issue.'])
    expect(invoiceProblems(issuer, { ...client, invoicing: { ...client.invoicing, address: '', reverseCharge: false } }, [{ description: '', amount: euros(0) }])).toEqual([
      'Invoicing, Clients needs an address for North Ltd.',
      'The app makes invoices without VAT for clients on reverse charge only. Tick reverse charge for North Ltd on Invoicing, Clients if it accounts for the VAT, or make this invoice elsewhere.',
      'Every line needs a description.',
      'Every line needs an amount above zero.',
    ])
  })
})

describe('the invoice mail', () => {
  const values = { number: '10-1-26', issued: civil('2026-10-21'), language: 'en', client: 'North Ltd', company: 'Example Studio', signatory: 'Ana Čolić' }

  it('fills the subject and body, with the month in the client’s language', () => {
    expect(filledMail('Invoice {number} - {month}', values)).toBe('Invoice 10-1-26 - October 2026')
    expect(filledMail(DEFAULT_MAIL_BODY, values)).toBe("Hello,\n\nI'm sending you the invoice for October 2026 in the attachment.\n\nBest regards,\nAna Čolić")
    expect(monthInLanguage(civil('2026-10-21'), 'hr')).toMatch(/^listopad/)
    expect(mailTemplateProblem('{month} {when}')).toBe('{when} is not one of {month}, {number}, {client}, {company}, {signatory}')
  })

  it('opens Gmail’s compose window filled in when the draft is off', () => {
    const url = new URL(gmailComposeUrl({ to: 'a@example.com', subject: 'Invoice 10-1-26', body: 'Hello,\nčć' }))
    expect(url.origin).toBe('https://mail.google.com')
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: 'cm', fs: '1', to: 'a@example.com', su: 'Invoice 10-1-26', body: 'Hello,\nčć' })
  })

  it('makes one MIME message with the PDF attached, in base64url', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 test')
    const raw = rawInvoiceMessage({ to: 'a@example.com', subject: 'Račun 10-1-26', body: 'Pozdrav,\nAna' }, '2026-10-north-invoice.pdf', pdf)
    expect(raw).not.toMatch(/[+/=]/)
    const message = new TextDecoder().decode(Uint8Array.from(atob(raw.replaceAll('-', '+').replaceAll('_', '/')), (letter) => letter.charCodeAt(0)))
    expect(message).toContain('To: a@example.com\r\n')
    expect(message).toContain(`Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode('Račun 10-1-26')))}?=\r\n`)
    expect(message).toContain('Content-Disposition: attachment; filename="2026-10-north-invoice.pdf"')
    expect(message).toContain(btoa('%PDF-1.7 test'))
  })
})

describe('invoice settings and client details', () => {
  it('reads the invoice keys, with the generator’s defaults for a blank value', () => {
    const { settings, problems } = parseSettings([
      { key: 'invoice_company_name', value: 'Example Studio d.o.o.' },
      { key: 'invoice_iban', value: 'hr62 1234 5670 0000 0000 1' },
      { key: 'invoice_number_pattern', value: '' },
      { key: 'invoice_mail_body', value: 'Hello,\r\n\r\n{month}' },
      { key: 'invoice_file_path', value: '{yyyy}/{client}.txt' },
      { key: 'invoice_mail_subject', value: 'Invoice\n {month}' },
    ])
    expect(settings.invoicing).toMatchObject({
      name: 'Example Studio d.o.o.',
      iban: 'HR6212345670000000001',
      numberPattern: DEFAULT_NUMBER_PATTERN,
      mailBody: 'Hello,\n\n{month}',
      filePath: DEFAULT_FILE_PATH,
      mailSubject: 'Invoice {month}',
    })
    expect(problems).toEqual([{ id: recordIdOf(SETTING_RECORDS, 'invoice_file_path'), label: 'invoice_file_path', reason: 'the path ends in a file name such as {yyyy}-{mm}-{client}-invoice.pdf, so the default is used' }])
    expect(settingsErrors({ ...DEFAULT_SETTINGS, invoicing: { ...DEFAULT_SETTINGS.invoicing, iban: 'HR00', numberPattern: '{yy}' } })).toEqual({
      iban: '"HR00" is not an IBAN',
      numberPattern: 'the pattern needs {n}, the sequence, exactly once',
    })
  })

  it('reads each client’s invoice details, a blank reverse charge as FALSE', () => {
    const reading = readClients(
      recordsOfRows(CORE_TABS.clients, [
        { sheetRow: 2, cells: { client: 'north', name: 'North Ltd', iban: 'XX00FAKE0101' } },
        { sheetRow: 3, cells: { client: 'east', iban: 'XX00FAKE0102', address: '1 Road', invoice_mail: 'ap@east.example', mail_language: 'HR', reverse_charge: true } },
        { sheetRow: 4, cells: { client: 'south', iban: 'XX00FAKE0103', mail_language: 'not a language tag', reverse_charge: 'maybe' } },
      ]),
    )
    expect(reading.facts.map((client) => [client.slug, client.invoicing])).toEqual([
      ['north', NO_CLIENT_INVOICING],
      ['east', { ...NO_CLIENT_INVOICING, address: '1 Road', invoiceMail: 'ap@east.example', mailLanguage: 'hr', reverseCharge: true }],
      ['south', NO_CLIENT_INVOICING],
    ])
    expect(reading.problems).toEqual([
      { id: recordIdOf(CLIENT_RECORDS, 'south'), label: 'south', reason: '"not a language tag" is not a language such as en or hr, so the mail is written in English' },
      { id: recordIdOf(CLIENT_RECORDS, 'south'), label: 'south', reason: 'reverse_charge "maybe" is neither TRUE nor FALSE, so it reads as FALSE' },
    ])
  })
})
