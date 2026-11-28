import type { CheckedProposal } from '../../src/shared/app/assistantOperations'

/** What a stored value looks like where a card should read words: a record id, a UUID, a month key, an ISO day or an object turned into text. */
const STORED_DATA: readonly RegExp[] = [/^[a-z][a-z-]*:(?!\/\/)\S+$/, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, /^\d{4}-\d{2}$/, /\b\d{4}-\d{2}-\d{2}\b/, /\[object Object\]/]

/** Each label and field value on the card that reads as stored data rather than words, by where it stands. */
export function storedDataOn(card: CheckedProposal): readonly string[] {
  return card.groups.flatMap((group) =>
    group.lines.flatMap((line) =>
      [
        { at: 'label', text: line.label },
        ...line.fields.flatMap((field) => [
          { at: `${field.name} before`, text: field.before },
          { at: `${field.name} after`, text: field.after },
        ]),
      ].flatMap(({ at, text }) => (text !== null && STORED_DATA.some((pattern) => pattern.test(text)) ? [`${group.noun.en.one} ${line.label}, ${at}: ${text}`] : [])),
    ),
  )
}
