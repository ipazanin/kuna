import { IBKR_FLEX_RECIPE } from './ibkrFlexRecipe'
import type { MailReader } from '../../workbook/domain/mailReader'
import { mailAddressesFault, mailAddressesOf, mailPhraseFault } from '../../../../shared/mail-filing/domain/mailSource'
import type { MailSearchFault } from '../../../../shared/mail-filing/domain/mailSource'

/** The fields of the mail card a person types. */
export interface MailReaderTexts {
  readonly senders: string
  readonly subject: string
  readonly contents: string
}

export type MailReaderField = keyof MailReaderTexts

/** The reader's fields as the card shows them, or IBKR's own terms before the file holds a reader. */
export function mailReaderTexts(saved: MailReader | null): MailReaderTexts {
  const { senders, subject, contents } = saved ?? IBKR_FLEX_RECIPE.mail
  return { senders: senders.join(', '), subject, contents }
}

/** A field that names nothing it needs, or one Gmail cannot search for, with the mail search's own fault. */
export type MailReaderFault = { readonly kind: 'missing' } | { readonly kind: 'unsearchable'; readonly search: MailSearchFault }

/** What each field lacks, null for one that reads. A switched-off reader may name no sender. */
export function mailReaderFaults(texts: MailReaderTexts, on: boolean): Readonly<Record<MailReaderField, MailReaderFault | null>> {
  const unsearchable = (search: MailSearchFault | null): MailReaderFault | null => (search === null ? null : { kind: 'unsearchable', search })
  const senders = mailAddressesOf(texts.senders)
  return {
    senders: senders.length === 0 ? (on ? { kind: 'missing' } : null) : unsearchable(mailAddressesFault(senders)),
    subject: unsearchable(mailPhraseFault('subject', texts.subject)),
    contents: unsearchable(mailPhraseFault('contents', texts.contents)),
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
  }
}
