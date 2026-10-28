import type { Money } from '../../money/money'

/** One field as a record gives it to a storage: text, with a day as `yyyy-mm-dd` and an amount as decimal text, or a flag. */
export type FieldValue = string | boolean

/** A record's filled fields, by their names in the workbook format. A blank field is absent. */
export type RecordFields = Readonly<Record<string, FieldValue>>

/** An amount as decimal text from its cents, such as `-95.49` or `1200.00`. */
export function amountText(money: Money): string {
  const cents = Math.abs(money)
  const sign = money < 0 ? '-' : ''
  return `${sign}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** The fields that are filled. A blank text or a missing value is left out, and a false flag is kept. */
export function filledFields(fields: Readonly<Record<string, FieldValue | null | undefined>>): RecordFields {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, FieldValue] => entry[1] !== null && entry[1] !== undefined && entry[1] !== ''))
}
