import type { CivilDate } from '../../../../shared/calendar/civilDate'

export const DEFAULT_MAIL_SUBJECT = 'Invoice {number}, {month}'

export const DEFAULT_MAIL_BODY = "Hello,\n\nI'm sending you the invoice for {month} in the attachment.\n\nBest regards,\n{signatory}"

const MAIL_TOKENS = ['{month}', '{number}', '{client}', '{company}', '{signatory}'] as const

const TOKEN = /\{[^}]*\}/g

/** What the mail's words in braces stand for. */
export interface MailValues {
  readonly number: string
  readonly issued: CivilDate
  /** A language tag the browser knows, such as en or hr, for the month's name. */
  readonly language: string
  readonly client: string
  readonly company: string
  readonly signatory: string
}

export interface InvoiceMail {
  readonly to: string
  readonly subject: string
  readonly body: string
}

/** Null when every word in braces is one the app fills in. */
export function mailTemplateProblem(template: string): string | null {
  const unknown = (template.match(TOKEN) ?? []).filter((token) => !(MAIL_TOKENS as readonly string[]).includes(token))
  return unknown.length === 0 ? null : `${unknown.join(', ')} is not one of ${MAIL_TOKENS.join(', ')}`
}

/** The issue month as the client reads it, such as October 2026. An unknown language falls back to English. */
export function monthInLanguage(issued: CivilDate, language: string): string {
  const day = new Date(`${issued}T00:00:00Z`)
  const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', timeZone: 'UTC' }
  try {
    return new Intl.DateTimeFormat(language || 'en', options).format(day)
  } catch {
    return new Intl.DateTimeFormat('en', options).format(day)
  }
}

export function filledMail(template: string, values: MailValues): string {
  return template
    .replaceAll('{month}', monthInLanguage(values.issued, values.language))
    .replaceAll('{number}', values.number)
    .replaceAll('{client}', values.client)
    .replaceAll('{company}', values.company)
    .replaceAll('{signatory}', values.signatory)
}

/** Gmail's compose window with the mail filled in, for a person who leaves the mail draft off. It cannot carry the attachment. */
export function gmailComposeUrl(mail: InvoiceMail): string {
  const query = new URLSearchParams({ view: 'cm', fs: '1', to: mail.to, su: mail.subject, body: mail.body })
  return `https://mail.google.com/mail/?${query}`
}
