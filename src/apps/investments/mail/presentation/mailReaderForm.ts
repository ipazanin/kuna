import { IBKR_FLEX_RECIPE } from '../domain/ibkrFlexRecipe'
import { words } from './words'
import type { MailReader } from '../../workbook/domain/mailReader'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { mailAddressesOf, mailAddressesProblem, mailContentsProblem, mailSubjectProblem } from '../../../../shared/mail-filing/domain/mailSource'

/** The fields of the mail card a person types. */
export interface MailReaderTexts {
  readonly senders: string
  readonly subject: string
  readonly contents: string
  readonly since: string
}

export type MailReaderField = keyof MailReaderTexts

/** The reader's fields as the card shows them, or IBKR's own terms and today before the file holds a reader. */
export function mailReaderTexts(saved: MailReader | null): MailReaderTexts {
  const { senders, subject, contents } = saved ?? IBKR_FLEX_RECIPE.mail
  return { senders: senders.join(', '), subject, contents, since: saved?.since ?? today() }
}

/** What each field lacks, null for one that reads. A switched-off reader may name no sender. */
export function mailReaderErrors(texts: MailReaderTexts, on: boolean): Readonly<Record<MailReaderField, string | null>> {
  const senders = mailAddressesOf(texts.senders)
  return {
    senders: senders.length === 0 ? (on ? words.card.sendersHelp : null) : mailAddressesProblem(senders),
    subject: mailSubjectProblem(texts.subject),
    contents: mailContentsProblem(texts.contents),
    since: parseCivilDate(texts.since) === null ? words.card.sinceMissing : null,
  }
}

/** The reader with one field as typed, once it reads. */
export function withMailField(reader: MailReader, field: MailReaderField, texts: MailReaderTexts): MailReader {
  switch (field) {
    case 'senders':
      return { ...reader, senders: mailAddressesOf(texts.senders) }
    case 'subject':
      return { ...reader, subject: texts.subject.trim() }
    case 'contents':
      return { ...reader, contents: texts.contents.trim() }
    case 'since':
      return { ...reader, since: parseCivilDate(texts.since)! }
  }
}
