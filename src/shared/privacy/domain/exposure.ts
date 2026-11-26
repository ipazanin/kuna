import type { Decimal } from '../../money/decimal'
import type { RecordId } from '../../storage/domain/recordId'

/**
 * How a stored field leaves the device.
 * - `plain`: as written, such as a date, a flag, an amount or a name the owner gave a category.
 * - `ref`: the id of a record, or a list of them, each as a ref that lasts one conversation.
 * - `identifier`: an IBAN or an OIB, as a token shaped like its mask while Anonymise is on.
 * - `party`: who was paid or who paid, as written, or under an alias for a person Kuna knows.
 * - `free-text`: what someone wrote, as untrusted text with identifiers and known persons replaced.
 * - `lines`: a list of small records, such as an invoice's lines, each text as its own exposure says and each amount as an
 *   amount of the app's currency, the same whatever Anonymise is set to.
 * - `never`: never, and the reader does not hand it over at all.
 */
export type Exposure = 'plain' | 'ref' | 'identifier' | 'party' | 'free-text' | 'lines' | 'never'

/** The exposures a text can leave under. */
export type TextExposure = 'plain' | 'identifier' | 'party' | 'free-text'

/** A stored value as a reader hands it over. A list holds texts of one exposure, such as every IBAN a record names, and each leaves as that exposure says. */
export type StoredValue = string | number | boolean | null | readonly string[]

/** A field that goes as text or a flag, with `read` for one stored in another shape. */
interface ValueField<R> {
  readonly meaning: string
  readonly exposure: TextExposure
  readonly read?: (record: R) => StoredValue
}

/** Whether an amount can go below zero, as a field's page tells the model, since apps sign their amounts differently. */
export type AmountSign = 'either' | 'zero-or-more'

/** A decimal amount a record stores beside its own currency, such as a trade's price. */
export interface DecimalAmount {
  readonly amount: Decimal
  readonly currency: string
}

/** A field that holds the id of one record. */
interface RefField {
  readonly meaning: string
  readonly exposure: 'ref'
  readonly to: string
  readonly list?: false
}

/** A field that holds the ids of several records of one kind, such as the labels of an item. */
interface RefListField {
  readonly meaning: string
  readonly exposure: 'ref'
  readonly to: string
  readonly list: true
}

/** A part of a line that holds text, which leaves as its exposure says. */
export interface TextPartDoc {
  readonly meaning: string
  readonly exposure: TextExposure
}

/** A part of a line that holds an amount of the app's currency, which leaves as any of the record's amounts does. */
export interface AmountPartDoc {
  readonly meaning: string
  readonly exposure: 'plain'
  readonly amount: 'app'
  readonly sign: AmountSign
}

/** What each part of a line means and how it leaves, with no default, as for a record's fields: an amount for a number, a text for a string. */
type LinePartDocs<Line> = { readonly [Part in keyof Line]-?: NonNullable<Line[Part]> extends number ? AmountPartDoc : NonNullable<Line[Part]> extends string ? TextPartDoc : never }

/** A field that holds a list of small records, such as an invoice's lines, so each text leaves beside its own amount. */
export interface LinesFieldDoc<Parts = Readonly<Record<string, TextPartDoc | AmountPartDoc>>> {
  readonly meaning: string
  readonly exposure: 'lines'
  readonly parts: Parts
}

interface NeverField {
  readonly meaning: string
  readonly exposure: 'never'
}

/** What a list of amounts beside a list of texts gets, since the model pairs the two by position and can pair them wrong. */
interface ParallelListRefused {
  readonly refused: 'Hold each text and its amount in one record of a lines field.'
}

/**
 * What a field means and how it leaves the device. An amount goes as written, with its currency: in cents of an
 * account's own or of the app's currency, or as a decimal in a currency the record names.
 */
export type FieldDoc<R> =
  | ValueField<R>
  | RefField
  | RefListField
  | { readonly meaning: string; readonly exposure: 'plain'; readonly amount: 'account' | 'app'; readonly sign: AmountSign }
  | { readonly meaning: string; readonly exposure: 'plain'; readonly decimal: (record: R) => DecimalAmount | null; readonly sign: AmountSign }
  | LinesFieldDoc
  | NeverField

/** Whether a list field of the record is named as the field is without Amounts, such as lines or line beside lineAmounts. */
type ParallelList<R, Field> = Field extends `${infer Texts}Amounts` ? (IsList<R, Texts> extends true ? true : IsList<R, `${Texts}s`>) : false

type IsList<R, Field> = Field extends keyof R ? (NonNullable<R[Field]> extends readonly unknown[] ? true : false) : false

/**
 * Every stored field of a record type, with no default, so a new field fails the typecheck until someone classes it. A field
 * that holds a list of record ids leaves as a list of refs, so the chat can follow it, and only a list field is a list of refs.
 * A list of small records leaves as lines, and a list beside another list it pairs with by position does not compile.
 */
export type FieldDocs<R> = {
  readonly [Field in keyof R]-?: NonNullable<R[Field]> extends readonly RecordId[]
    ? RefListField
    : NonNullable<R[Field]> extends readonly (infer Line)[]
      ? ParallelList<R, Field> extends true
        ? ParallelListRefused
        : Line extends string | number | boolean
          ? ValueField<R> | NeverField
          : ValueField<R> | LinesFieldDoc<LinePartDocs<Line>> | NeverField
      : Exclude<FieldDoc<R>, RefListField | LinesFieldDoc>
}
