import { restOfWhole } from '../money/partsOfWhole'
import type { GivenPart } from '../money/partsOfWhole'

/** One part of a split as its fields hold it: an amount typed above zero, or the rest. `held` is what the caller keeps beside the part. */
export interface SplitField<Held = null> {
  /** Unique on the page, so a removed part takes its fields with it. */
  readonly id: number
  amount: string
  category: string
  note: string
  rest: boolean
  readonly held: Held | null
}

let nextId = 0

export function splitField<Held = null>(amount: string, category: string, note: string, rest: boolean, held: Held | null = null): SplitField<Held> {
  nextId += 1
  return { id: nextId, amount, category, note, rest, held }
}

/** Reads a typed amount in the caller's cents, or null for one that does not read. */
export type TypedCents<Cents extends number> = (text: string) => Cents | null

/** What the typed amounts leave of the whole for the rest, where an amount that does not read counts as nothing. */
export function restOfFields<Cents extends number>(whole: Cents, fields: readonly SplitField<unknown>[], typed: TypedCents<Cents>): Cents {
  return restOfWhole(
    whole,
    fields.flatMap((field) => {
      const amount = field.rest ? null : typed(field.amount)
      return amount === null ? [] : [amount]
    }),
  )
}

/** The parts as the split rule takes them, the rest as `'rest'`, or null while an amount does not read. */
export function givenParts<Cents extends number>(fields: readonly SplitField<unknown>[], typed: TypedCents<Cents>): GivenPart<Cents>[] | null {
  const given = fields.map((field): GivenPart<Cents> | null => (field.rest ? 'rest' : typed(field.amount)))
  return given.every((part) => part !== null) ? given : null
}
