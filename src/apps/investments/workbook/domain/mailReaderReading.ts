import { MAIL_READER_RECORDS } from './investmentKinds'
import type { MailReader } from './mailReader'
import { words } from './words'
import { mailAddressesFault, mailAddressesOf, mailPhraseFault } from '../../../../shared/mail-filing/domain/mailSource'
import { words as mailWords } from '../../../../shared/mail-filing/domain/words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { booleanOf, ownId, refuse, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** A reader that is on names its senders, and its phrases are ones Gmail can search for. */
export function mailReaderOf(fields: StoredFields, id: RecordId | null): MailReader {
  const recipe = textOf(fields.recipe).trim()
  if (recipe === '') refuse(words.mailReaderNoRecipe)
  const on = fields.on === undefined ? false : (booleanOf(fields.on) ?? refuse(words.notAFlag('on', fields.on.text)))
  const senders = mailAddressesOf(textOf(fields.senders))
  const subject = textOf(fields.subject)
  const contents = textOf(fields.contents)
  if (on && senders.length === 0) refuse(words.mailReaderNoSender)
  const fault = mailAddressesFault(senders) ?? mailPhraseFault('subject', subject) ?? mailPhraseFault('contents', contents)
  if (fault !== null) refuse(mailWords.searchFault(fault))
  const leftOut = textOf(fields.left_out)
  return {
    id: ownId(id),
    recipe,
    on,
    senders,
    subject,
    contents,
    since: requiredDate(fields, 'since'),
    leftOut: leftOut === '' ? [] : leftOut.split(','),
  }
}

export const MAIL_READER_CODEC: RecordCodec<MailReader> = withIdField(
  MAIL_READER_RECORDS,
  (fields) => labelWords([textOf(fields.recipe)]),
  mailReaderOf,
  (reader) =>
    filledFields({
      recipe: reader.recipe,
      on: reader.on ? true : null,
      senders: reader.senders.join(', '),
      subject: reader.subject,
      contents: reader.contents,
      since: reader.since,
      left_out: reader.leftOut.join(','),
    }),
)
