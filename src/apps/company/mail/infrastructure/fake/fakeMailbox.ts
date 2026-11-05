import { addDays, parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { MailFolders, Mailbox } from '../../../../../shared/mail-filing/application/mailFiling'
import { fakeMailFoldersOf, fakeMailboxOf } from '../../../../../shared/mail-filing/infrastructure/fake/fakeMail'
import type { FakeFiled, FakeMadeFile, FakeMail } from '../../../../../shared/mail-filing/infrastructure/fake/fakeMail'
import { sampleCamtLabel, sampleCamtXml } from '../../../imports/infrastructure/fake/sampleImportFiles'
import { FAKE_BOOKS_STATEMENTS, PAGE_FAKE_MADE_FILES, sampleStatementByMail } from '../../../workbook/infrastructure/fake/fakeFolderFiles'
import { FAKE_FOLDERS, fakeWorkbookRecords } from '../../../workbook/infrastructure/fake/fakeWorkbook'

/**
 * The fake build's Gmail and the folders its mail goes into, for `?fake=mail`, `?fake=mail-nothing-new`,
 * `?fake=mail-failed`, `?fake=mail-upload-failed`, `?fake=mail-rate-limited`, `?fake=mail-switches-off`
 * and `?fake=mail-no-sender`. The bank and the accountant mail from example.com addresses, and every
 * subject and file name copies the shape of a real one with made-up names.
 */

const BANK = 'statements@bank.example.com'
const ACCOUNTANT = 'office@accountant.example.com'

/**
 * The rows `?fake=mail` variants add to the books, as the person would type them on Settings,
 * General: every kind of the accountant's mail switched on, none with `?fake=mail-switches-off`, and
 * with `?fake=mail-no-sender` the payroll alone, without the accountant's address.
 */
export function fakeMailSettings(variant: string | null): readonly { readonly key: string; readonly value: string }[] {
  const switches = variant === 'mail-switches-off' ? [] : variant === 'mail-no-sender' ? ['hr_payroll_mail_sync'] : ['hr_payroll_mail_sync', 'hr_vat_mail_sync', 'hr_invoices_mail_sync']
  return [
    { key: 'statements_mail_from', value: BANK },
    { key: 'statements_mail_subject', value: 'Izvadak' },
    { key: 'mail_since', value: '2026-01-01' },
    ...(variant === 'mail-no-sender' ? [] : [{ key: 'hr_accountant_mail_from', value: ACCOUNTANT }]),
    ...switches.map((key) => ({ key, value: 'TRUE' })),
    { key: 'hr_payroll_mail_subject', value: 'Plaća za' },
    { key: 'hr_vat_mail_subject', value: 'PDV za' },
    { key: 'hr_invoices_mail_subject', value: 'Račun za' },
    { key: 'hr_incoming_invoices_folder', value: FAKE_FOLDERS.incomingInvoices.join('/') },
  ]
}

/** The main account's newest statement on the fake ledger, which the folders already hold as a PDF. */
function newestMainStatement(): { readonly day: string; readonly number: string } {
  const label = String((fakeWorkbookRecords('drive')['ledger-row'] ?? []).find((row) => row.account === 'main')?.statement ?? '')
  const match = /^(\d{4}-\d{2}-\d{2})-statement-(\d+)$/.exec(label)
  return { day: match?.[1] ?? '2026-10-01', number: match?.[2] ?? '001' }
}

/** A bank's statement file name for a day, such as IZV_2026_10_07 06_00_00_000_001.pdf. */
function bankFileName(day: string, extension: string): string {
  return `IZV_${day.replaceAll('-', '_')} 06_00_00_000_001.${extension}`
}

export function fakeMails(): FakeMail[] {
  const sample = sampleCamtLabel()
  const sampleDay = sample.slice(0, 10)
  const sampleNumber = sample.slice(-3)
  const newest = newestMainStatement()
  const nextDay = addDays(parseCivilDate(sampleDay)!, 1)
  const laterDay = addDays(nextDay, 1)
  const laterNumber = String(Number(sampleNumber) + 1).padStart(3, '0')
  return [
    {
      id: 'bank-pdf-new',
      subject: `Izvadak ${laterNumber}, Example Studio d.o.o.`,
      at: `${laterDay}T05:10:00Z`,
      attachments: [
        { name: bankFileName(laterDay, 'pdf'), content: 'statement pdf' },
        { name: bankFileName(laterDay, 'html'), content: 'statement html' },
      ],
      filed: false,
    },
    {
      id: 'bank-xml',
      subject: `Izvadak ${sampleNumber}, Example Studio d.o.o.`,
      at: `${sampleDay}T05:11:00Z`,
      attachments: [{ name: bankFileName(sampleDay, 'xml'), content: 'sample-camt' }],
      filed: true,
    },
    {
      id: 'bank-xml-again',
      subject: `Izvadak ${sampleNumber}, Example Studio d.o.o.`,
      at: `${nextDay}T05:11:00Z`,
      attachments: [{ name: bankFileName(nextDay, 'xml'), content: 'sample-camt' }],
      filed: true,
    },
    {
      id: 'bank-pdf-filed',
      subject: `Izvadak ${newest.number}, Example Studio d.o.o.`,
      at: `${newest.day}T05:10:00Z`,
      attachments: [{ name: bankFileName(newest.day, 'pdf'), content: 'older statement pdf' }],
      filed: true,
    },
    {
      id: 'bank-terms',
      subject: 'Izvadak 000, novi opći uvjeti poslovanja',
      at: `${addDays(parseCivilDate(newest.day)!, -2)}T09:00:00Z`,
      attachments: [{ name: 'Opći uvjeti poslovanja.xml', content: '<obavijest>Opći uvjeti poslovanja</obavijest>' }],
      filed: false,
    },
    {
      id: 'payroll-09',
      subject: 'Plaća za 9/2026',
      at: '2026-10-05T08:30:00Z',
      attachments: [
        { name: 'Example plaća 9 2026.xlsx', content: 'salary 2026-09' },
        { name: 'IP1 obrazac 9 2026.pdf', content: 'ip1 2026-09' },
        { name: 'Platni nalog_Example 9 2026.pdf', content: 'salary order 2026-09' },
        { name: 'UN0926.xml', content: 'salary order xml 2026-09' },
      ],
      filed: false,
    },
    {
      id: 'payroll-09-rent',
      subject: 'FW: Plaća za 9/2026',
      at: '2026-10-05T08:40:00Z',
      attachments: [
        { name: 'Platni nalog za zakup 9 2026.pdf', content: 'rent order 2026-09' },
        { name: 'UN0926Z.xml', content: 'rent order xml 2026-09' },
      ],
      filed: false,
    },
    { id: 'payroll-08', subject: 'RE: Plaća za 8/2026', at: '2026-09-04T08:30:00Z', attachments: [{ name: 'Example plaća 8 2026.xlsx', content: 'salary 2026-08' }], filed: true },
    { id: 'vat-09', subject: 'PDV za 9/26', at: '2026-10-14T12:00:00Z', attachments: [{ name: 'PDV 9 2026_Example.xlsx', content: 'vat 2026-09' }], filed: false },
    { id: 'vat-08-fix', subject: 'RE: PDV za 8/2026 - ispravak', at: '2026-10-02T12:00:00Z', attachments: [{ name: 'PDV 8 2026_Example.xlsx', content: 'vat 2026-08 corrected' }], filed: false },
    { id: 'vat-07-again', subject: 'PDV za 7/2026', at: '2026-10-01T12:00:00Z', attachments: [{ name: 'PDV 7 2026_Example.xlsx', content: 'vat 2026-07' }], filed: false },
    { id: 'invoice-10', subject: 'Račun za 9/2026', at: '2026-10-03T08:00:00Z', attachments: [{ name: '142-1-1_Example.pdf', content: 'invoice 142' }], filed: false },
    { id: 'invoice-09', subject: 'Račun za 8/2026', at: '2026-09-02T08:00:00Z', attachments: [{ name: '131-1-1_Example.pdf', content: 'invoice 131' }], filed: true },
  ]
}

/** What the fake folders hold before any sync. The sample statement is among them unless the variant brings it by mail. */
function fakeFiled(variant: string | null): FakeFiled[] {
  const records = fakeWorkbookRecords('drive')
  const statements = [...new Set((records['ledger-row'] ?? []).map((row) => `${String(row.statement)}-${String(row.account)}.xml`))]
  const newest = newestMainStatement()
  return [
    ...[...statements, ...(sampleStatementByMail(variant) ? [] : [`${sampleCamtLabel()}-main.xml`])].map((name) => ({
      folder: FAKE_FOLDERS.statements,
      folders: [`${name.slice(0, 4)}-statements`],
      name,
      created: `${name.slice(0, 10)}T07:00:00Z`,
      content: null,
    })),
    {
      folder: FAKE_FOLDERS.statements,
      folders: [`${newest.day.slice(0, 4)}-statements`],
      name: `${newest.day}-statement-${newest.number}.pdf`,
      created: `${newest.day}T07:00:00Z`,
      content: 'older statement pdf',
    },
    { folder: FAKE_FOLDERS.payroll, folders: ['2026-payroll', '2026-08'], name: '2026-08-salary.xlsx', created: '2026-09-05T11:00:00Z', content: 'salary 2026-08' },
    { folder: FAKE_FOLDERS.vatReturns, folders: ['2026-vat-returns'], name: '2026-08-pdv.xlsx', created: '2026-09-15T11:00:00Z', content: 'vat 2026-08' },
    { folder: FAKE_FOLDERS.vatReturns, folders: ['2026-vat-returns'], name: '2026-07-pdv.xlsx', created: '2026-08-14T11:00:00Z', content: null },
    { folder: FAKE_FOLDERS.incomingInvoices, folders: ['2026-incoming-invoices', '2026-09'], name: '2026-09-02-accounting.pdf', created: '2026-09-03T11:00:00Z', content: 'invoice 131' },
  ]
}

function bytesOf(content: string): ArrayBuffer {
  return new TextEncoder().encode(content === 'sample-camt' ? sampleCamtXml() : content).buffer as ArrayBuffer
}

/** The fake Gmail, where `?fake=mail-failed` fails the VAT return search, so one source fails beside the others. */
export function fakeMailbox(variant: string | null): Mailbox {
  return fakeMailboxOf({ mails: fakeMails(), failingSearchPhrase: 'PDV za', bytesOf }, variant)
}

/** The fake folders the mail goes into, at the paths the fake books name and the statements folder new books from mail make beside the books file. */
export function fakeMailFolders(variant: string | null, made: FakeMadeFile[] = PAGE_FAKE_MADE_FILES): MailFolders {
  const known = [FAKE_FOLDERS.statements, FAKE_BOOKS_STATEMENTS, FAKE_FOLDERS.payroll, FAKE_FOLDERS.vatReturns, FAKE_FOLDERS.incomingInvoices]
  return fakeMailFoldersOf({ filed: fakeFiled(variant), known, bytesOf }, variant, made)
}
