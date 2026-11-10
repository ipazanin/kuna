import type { Decimal } from '../../money/decimal'

/**
 * How a stored field leaves the device.
 * - `plain`: as written, such as a date, a flag, an amount or a name the owner gave a category.
 * - `ref`: the id of a record, as a ref that lasts one conversation.
 * - `identifier`: an IBAN or an OIB, as a token shaped like its mask while Anonymise is on.
 * - `party`: who was paid or who paid, as written, or under an alias for a person Kuna knows.
 * - `free-text`: what someone wrote, as untrusted text with identifiers and known persons replaced.
 * - `never`: never, and the reader does not hand it over at all.
 */
export type Exposure = 'plain' | 'ref' | 'identifier' | 'party' | 'free-text' | 'never'

/** A stored value as a reader hands it over. A list holds texts of one exposure, such as every IBAN a record names, and each leaves as that exposure says. */
export type StoredValue = string | number | boolean | null | readonly string[]

/** A field that goes as text or a flag, with `read` for one stored in another shape. */
interface ValueField<R> {
  readonly meaning: string
  readonly exposure: 'plain' | 'identifier' | 'party' | 'free-text'
  readonly read?: (record: R) => StoredValue
}

/** Whether an amount can go below zero, as a field's page tells the model, since apps sign their amounts differently. */
export type AmountSign = 'either' | 'zero-or-more'

/** A decimal amount a record stores beside its own currency, such as a trade's price. */
export interface DecimalAmount {
  readonly amount: Decimal
  readonly currency: string
}

/**
 * What a field means and how it leaves the device. An amount goes as written, with its currency: in cents of an
 * account's own or of the app's currency, or as a decimal in a currency the record names.
 */
export type FieldDoc<R> =
  | ValueField<R>
  | { readonly meaning: string; readonly exposure: 'ref'; readonly to: string }
  | { readonly meaning: string; readonly exposure: 'plain'; readonly amount: 'account' | 'app'; readonly sign: AmountSign }
  | { readonly meaning: string; readonly exposure: 'plain'; readonly decimal: (record: R) => DecimalAmount | null; readonly sign: AmountSign }
  | { readonly meaning: string; readonly exposure: 'never' }

/** Every stored field of a record type, with no default, so a new field fails the typecheck until someone classes it. */
export type FieldDocs<R> = { readonly [Field in keyof R]-?: FieldDoc<R> }
