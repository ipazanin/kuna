/** What one record is called in an English sentence, such as "an invoice" and "3 invoices". */
export interface EnglishNoun {
  readonly one: string
  readonly many: string
  readonly article: 'a' | 'an'
}

/**
 * What one record is called in a Croatian sentence: the noun alone (račun), of one record (računa),
 * after 2 to 4 and after 5 or more, and the gender that the words around it follow.
 */
export interface CroatianNoun {
  readonly one: string
  readonly of: string
  readonly few: string
  readonly other: string
  readonly gender: 'masculine' | 'feminine' | 'neuter'
}

export interface RecordNoun {
  readonly en: EnglishNoun
  readonly hr: CroatianNoun
}

/** A kind of record the workbook holds, whose records are of type `R`. Its name starts every `RecordId` of the kind. */
export interface RecordKind<R = unknown> {
  readonly name: string
  readonly noun: RecordNoun
  /** The kind whose records these are parts of, such as an entry's items, and the field of a part that names its whole. */
  readonly partOf?: WholeOfPart
  readonly __record?: R
}

/** The kind of the whole a part belongs to, by name and noun, and the field of the part that holds the whole's id, empty on a part of no whole. */
export interface WholeOfPart {
  readonly kind: string
  readonly noun: RecordNoun
  readonly field: string
}

export function recordKind<R>(name: string, noun: RecordNoun, partOf?: { readonly kind: RecordKind; readonly field: keyof R & string }): RecordKind<R> {
  return partOf === undefined ? { name, noun } : { name, noun, partOf: { kind: partOf.kind.name, noun: partOf.kind.noun, field: partOf.field } }
}
