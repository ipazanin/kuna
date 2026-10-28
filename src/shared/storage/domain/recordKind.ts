/** What one record is called in a sentence, such as "an invoice" and "3 invoices". */
export interface RecordNoun {
  readonly one: string
  readonly many: string
  readonly article: 'a' | 'an'
}

/** A kind of record the workbook holds, whose records are of type `R`. Its name starts every `RecordId` of the kind. */
export interface RecordKind<R = unknown> {
  readonly name: string
  readonly noun: RecordNoun
  readonly __record?: R
}

export function recordKind<R>(name: string, one: string, many: string, article: RecordNoun['article'] = 'a'): RecordKind<R> {
  return { name, noun: { one, many, article } }
}
