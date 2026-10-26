import { civilDateIn } from '../../../../shared/calendar/civilDate'
import { monthKey, monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { fold } from '../../../../shared/text/fold'
import { afterPhrase, yearFolderName } from '../../../../features/mail/domain/mailSource'
import type { AttachmentNaming, MailAttachment, MailMessage } from '../../../../features/mail/domain/mailSource'
import { weekdaysEmployed } from '../employees/employees'
import type { Employee } from '../employees/employees'

/** The accountant issues and mails an invoice on the same day, in Croatia. */
const ACCOUNTANT_TIME_ZONE = 'Europe/Zagreb'

/** The kinds of payment order the payroll mail carries: the owner's rent, and the company's salaries. */
type PaymentOrderKind = 'rent' | 'salary'

/** The month or period a subject names after its phrase, such as "Plaća za 9/2026", with a two-digit year read as 20xx where `shortYears` allows it. */
function monthAfter(subject: string, phrase: string, shortYears: boolean): MonthKey | null {
  const match = (shortYears ? /^\s+(\d{1,2})\s*\/\s*(\d{4}|\d{2})\b/ : /^\s+(\d{1,2})\s*\/\s*(\d{4})\b/).exec(afterPhrase(subject, phrase) ?? '')
  if (match === null) return null
  const month = Number(match[1])
  const year = Number(match[2]!.length === 2 ? `20${match[2]}` : match[2])
  return month >= 1 && month <= 12 ? monthKey(year, month) : null
}

/** The worked month the payroll mail's subject names, such as 2026-09 for "RE: Plaća za 9/2026". Never the mail's date, since a month is mailed when the accountant gets to it. */
export function payrollMonthOf(subject: string, phrase: string): MonthKey | null {
  return monthAfter(subject, phrase, false)
}

/** The period the VAT return mail's subject names, such as 2025-08 for "PDV za 8/25". The return is mailed the month after, so the mail's date names the wrong month. */
export function vatPeriodOf(subject: string, phrase: string): MonthKey | null {
  return monthAfter(subject, phrase, true)
}

function unmatched(attachments: readonly MailAttachment[], reason: string): AttachmentNaming[] {
  return attachments.map((attachment) => ({ kind: 'unmatched', attachment, reason }))
}

function named(attachment: MailAttachment, folders: readonly string[], name: string): AttachmentNaming {
  return { kind: 'named', attachment, folders, name, redelivery: null }
}

/** A payment order's kind by the front of its file name, or null for an order of a kind the app does not know, which is never filed under a guess. */
function paymentOrderKind(folded: string): PaymentOrderKind | null {
  if (/^PLATNI NALOG ZA ZAKUP/.test(folded)) return 'rent'
  if (/^PLATNI NALOG_/.test(folded)) return 'salary'
  return null
}

/** The employee an IP1 form is for: the one whose name it carries, or else the only one employed in the month. */
function ip1Employee(folded: string, month: MonthKey, employees: readonly Employee[]): Employee | null {
  const named = employees.filter((employee) => employee.name !== '' && fold(employee.name).split(' ').every((word) => folded.includes(word)))
  if (named.length === 1) return named[0]!
  const employed = employees.filter((employee) => weekdaysEmployed(employee, month) !== null)
  return employed.length === 1 ? employed[0]! : null
}

/** A name as a file name carries it, such as ana-horvat for Ana Horvat. */
function fileWords(name: string): string {
  return fold(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Where each attachment of a payroll mail goes, under `<year>-<folder>/<month>` of the month the
 * subject names. Each document is named for what it is: the salary workbook, the IP1 form of the
 * employee it is for, and each payment order as a PDF with the bank's XML beside it, which takes
 * its kind from the order PDF in the same mail. A mail whose subject names no month, an order of
 * an unknown kind and an XML without an order beside it match no rule.
 */
export function payrollNamings(message: MailMessage, phrase: string, folder: readonly string[], employees: readonly Employee[]): AttachmentNaming[] {
  const month = payrollMonthOf(message.subject, phrase)
  if (month === null) return unmatched(message.attachments, 'The subject names no month, such as 9/2026.')
  const folders = [yearFolderName(month.slice(0, 4), folder), month]
  const orderKind = message.attachments.map((attachment) => paymentOrderKind(fold(attachment.name))).find((kind) => kind !== null) ?? null
  return message.attachments.map((attachment): AttachmentNaming => {
    const folded = fold(attachment.name)
    if (/^\S+ PLACA/.test(folded)) return named(attachment, folders, `${month}-salary.xlsx`)
    if (/^IP1 OBRAZAC/.test(folded)) {
      const employee = ip1Employee(folded, month, employees)
      return employee === null
        ? { kind: 'unmatched', attachment, reason: 'It names no one on the employees tab, and no single employee worked that month to file it for.' }
        : named(attachment, folders, `${month}-ip1-form-${fileWords(employee.name || employee.slug)}.pdf`)
    }
    const kind = paymentOrderKind(folded)
    if (kind !== null) return named(attachment, folders, `${month}-payment-order-${kind}.pdf`)
    if (/^PLATNI NALOG/.test(folded)) return { kind: 'unmatched', attachment, reason: 'It is a payment order of a kind the app does not know, so it is not filed under a guess.' }
    if (/^UN/.test(folded) && folded.endsWith('.XML')) {
      return orderKind === null ? { kind: 'unmatched', attachment, reason: 'No payment order PDF in the same mail says which order it carries.' } : named(attachment, folders, `${month}-payment-order-${orderKind}.xml`)
    }
    return { kind: 'unmatched', attachment, reason: 'It is not a payroll document the app knows how to name.' }
  })
}

/** Where each attachment of a VAT return mail goes: the workbook as `<period>-pdv.xlsx` in its year's folder, by the period the subject names. */
export function vatNamings(message: MailMessage, phrase: string, folder: readonly string[]): AttachmentNaming[] {
  const period = vatPeriodOf(message.subject, phrase)
  if (period === null) return unmatched(message.attachments, 'The subject names no period, such as 9/2026.')
  return message.attachments.map((attachment) =>
    /^PDV\b.*\.XLSX$/.test(fold(attachment.name))
      ? named(attachment, [yearFolderName(period.slice(0, 4), folder)], `${period}-pdv.xlsx`)
      : { kind: 'unmatched', attachment, reason: "It is not the accountant's VAT return workbook." },
  )
}

/**
 * Where each attachment of the accountant's invoice mail goes: the PDF named for its number, such
 * as 135-1-1_Example.pdf, as `<day>-accounting.pdf` in `<year>-<folder>/<month>` of the day it was
 * mailed in Croatia. The subject's month is whatever the accountant last typed, so it is not read.
 */
export function invoiceNamings(message: MailMessage, folder: readonly string[]): AttachmentNaming[] {
  const day = civilDateIn(message.date, ACCOUNTANT_TIME_ZONE)
  return message.attachments.map((attachment) =>
    /^\d+-\d+-\d+_.+\.PDF$/.test(fold(attachment.name))
      ? named(attachment, [yearFolderName(day.slice(0, 4), folder), monthOf(day)], `${day}-accounting.pdf`)
      : { kind: 'unmatched', attachment, reason: "It is not the accountant's invoice PDF." },
  )
}
