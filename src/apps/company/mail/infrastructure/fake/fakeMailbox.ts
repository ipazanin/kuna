import { addDays, parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { Mailbox } from '../../../../../shared/mail/application/mailReading'
import { fakeMailboxOf } from '../../../../../shared/mail/infrastructure/fake/fakeMail'
import type { FakeMail } from '../../../../../shared/mail/infrastructure/fake/fakeMail'
import { sampleCamtLabel, sampleCamtXml } from '../../../imports/infrastructure/fake/sampleImportFiles'
import { fakeWorkbookRecords } from '../../../workbook/infrastructure/fake/fakeWorkbook'
import { camtStatementOf } from '../../../workbook/domain/rowOrigin'

/**
 * The fake build's Gmail for the bank's statement mail. The bank mails from an example.com address, and every subject and file
 * name copies the shape of a real one with made-up names. Only a variant that starts with `mail` and `?fake=held-statement` get
 * mail the books lack. Elsewhere the mail lapsed after the main account's newest row, which takes the bank's camt file from then.
 * `?fake=mail-nothing-new` keeps only mail the books already hold,
 * `?fake=held-statement` adds the first statement of an account the accounts tab lacks, `?fake=slow-statements` takes three
 * seconds to search, `?fake=mail-failed` fails the search and `?fake=mail-rate-limited` answers it as Gmail still asking to slow down.
 */

const BANK = 'statements@bank.example.com'

const SUBJECT = 'Izvadak'

/** The rows the fake books on Drive, and the workbook `?fake=browser-mail` keeps in this browser, hold for the bank's mail, as the person would type them on Settings, General. `?fake=mail-off` leaves them out. */
export const FAKE_MAIL_SETTINGS: readonly { readonly key: string; readonly value: string }[] = [
  { key: 'statements_mail_from', value: BANK },
  { key: 'statements_mail_subject', value: SUBJECT },
]

/** Whether the bank still mails statements the books lack in a variant, so the main account takes the mail on every day from its first. */
export function bankStillMails(variant: string | null): boolean {
  return variant?.startsWith('mail') === true || variant === 'held-statement' || variant === 'browser-mail'
}

/** An IBAN no account of the fake workbook holds, so its statement waits for the person to add the account. */
const UNKNOWN_ACCOUNT_IBAN = 'XX43FAKE0000000000000003'

const SLOW_SEARCH_MS = 3_000

/** The main account's newest statement on the fake ledger, whose PDF the bank mailed before. */
function newestMainStatement(): { readonly day: string; readonly number: string } {
  const label = String((fakeWorkbookRecords('drive')['ledger-row'] ?? []).find((row) => row.account === 'main')?.statement ?? '')
  const camt = camtStatementOf(label)
  return { day: camt?.created ?? '2026-10-01', number: camt?.sequence ?? '001' }
}

/** A bank's statement file name for a day, such as IZV_2026_10_07 06_00_00_000_001.pdf. */
function bankFileName(day: string, extension: string): string {
  return `IZV_${day.replaceAll('-', '_')} 06_00_00_000_001.${extension}`
}

/**
 * The bank's mail: the sample statement mailed twice, a newer statement's PDF beside its HTML copy, an older PDF and a notice that
 * is no statement. Where the mail lapsed, only the older PDF and the notice are left.
 */
export function fakeMails(variant: string | null): FakeMail[] {
  return bankMails(variant).filter((mail) => mail.filed || bankStillMails(variant))
}

function bankMails(variant: string | null): FakeMail[] {
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
      filed: false,
    },
    {
      id: 'bank-xml-again',
      subject: `Izvadak ${sampleNumber}, Example Studio d.o.o.`,
      at: `${nextDay}T05:11:00Z`,
      attachments: [{ name: bankFileName(nextDay, 'xml'), content: 'sample-camt' }],
      filed: false,
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
      filed: true,
    },
    ...(variant === 'held-statement'
      ? [
          {
            id: 'bank-xml-unknown-account',
            subject: 'Izvadak 001, Example Studio d.o.o.',
            at: `${sampleDay}T05:12:00Z`,
            attachments: [{ name: `${bankFileName(sampleDay, 'xml').slice(0, -4)} 2.xml`, content: 'unknown-account-camt' }],
            filed: false,
          },
        ]
      : []),
  ]
}

function bytesOf(content: string): ArrayBuffer {
  const xml = content === 'sample-camt' ? sampleCamtXml() : content === 'unknown-account-camt' ? sampleCamtXml({ iban: UNKNOWN_ACCOUNT_IBAN, sequence: 1 }) : content
  return new TextEncoder().encode(xml).buffer as ArrayBuffer
}

/** The fake Gmail, where `?fake=mail-failed` fails the bank's statement search. */
export function fakeMailbox(variant: string | null): Mailbox {
  const mailbox = fakeMailboxOf({ mails: fakeMails(variant), failingSearchPhrase: SUBJECT, bytesOf }, variant)
  if (variant !== 'slow-statements') return mailbox
  return {
    ...mailbox,
    async search(query, pageToken) {
      if (pageToken === null) await new Promise((resolve) => setTimeout(resolve, SLOW_SEARCH_MS))
      return mailbox.search(query, pageToken)
    },
  }
}
