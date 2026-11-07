import { addDays, parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { MailFolders, Mailbox } from '../../../../../shared/mail-filing/application/mailFiling'
import { fakeMailFoldersOf, fakeMailboxOf } from '../../../../../shared/mail-filing/infrastructure/fake/fakeMail'
import type { FakeFiled, FakeMadeFile, FakeMail } from '../../../../../shared/mail-filing/infrastructure/fake/fakeMail'
import { sampleCamtLabel, sampleCamtXml } from '../../../imports/infrastructure/fake/sampleImportFiles'
import { FAKE_BOOKS_STATEMENTS, PAGE_FAKE_MADE_FILES, sampleStatementByMail } from '../../../workbook/infrastructure/fake/fakeFolderFiles'
import { FAKE_FOLDERS, fakeWorkbookRecords } from '../../../workbook/infrastructure/fake/fakeWorkbook'

/**
 * The fake build's Gmail and the folders its mail goes into, for `?fake=mail`, `?fake=mail-nothing-new`,
 * `?fake=mail-failed`, `?fake=mail-upload-failed` and `?fake=mail-rate-limited`. The bank mails from an
 * example.com address, and every subject and file name copies the shape of a real one with made-up names.
 */

const BANK = 'statements@bank.example.com'

const SUBJECT = 'Izvadak'

/** The rows `?fake=mail` variants add to the books, as the person would type them on Settings, General. */
export const FAKE_MAIL_SETTINGS: readonly { readonly key: string; readonly value: string }[] = [
  { key: 'statements_mail_from', value: BANK },
  { key: 'statements_mail_subject', value: SUBJECT },
  { key: 'mail_since', value: '2026-01-01' },
]

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
    })),
    {
      folder: FAKE_FOLDERS.statements,
      folders: [`${newest.day.slice(0, 4)}-statements`],
      name: `${newest.day}-statement-${newest.number}.pdf`,
      created: `${newest.day}T07:00:00Z`,
    },
  ]
}

function bytesOf(content: string): ArrayBuffer {
  return new TextEncoder().encode(content === 'sample-camt' ? sampleCamtXml() : content).buffer as ArrayBuffer
}

/** The fake Gmail, where `?fake=mail-failed` fails the bank's statement search. */
export function fakeMailbox(variant: string | null): Mailbox {
  return fakeMailboxOf({ mails: fakeMails(), failingSearchPhrase: SUBJECT, bytesOf }, variant)
}

/** The fake folders the mail goes into, at the paths the fake books name and the statements folder new books from mail make beside the books file. */
export function fakeMailFolders(variant: string | null, made: FakeMadeFile[] = PAGE_FAKE_MADE_FILES): MailFolders {
  const known = [FAKE_FOLDERS.statements, FAKE_BOOKS_STATEMENTS]
  return fakeMailFoldersOf({ filed: fakeFiled(variant), known }, variant, made)
}
