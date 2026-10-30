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
  readonly __record?: R
}

export function recordKind<R>(name: string, noun: RecordNoun): RecordKind<R> {
  return { name, noun }
}
