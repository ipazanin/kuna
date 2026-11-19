import { parseCivilDate } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import { language } from '../text/language'
import type { Money } from './money'
import { moneyAt, percentFromWhole, percentFromWritten, writtenPercent } from './percent'
import type { Percent } from './percent'
import { AMOUNT_SEPARATORS } from './typedAmount'

/** All of it, which a part of 100% is. */
const WHOLE = percentFromWhole(100)

/** A part as a person types it: up to three whole digits and two decimals, with a point or a comma, and an optional % after it. */
const TYPED_PART = /^(\d{1,3})(?:[.,](\d{1,2}))?\s*%?$/

/** A dated change of your part of something you own or owe with others: the part from that day on. */
export interface PartChange {
  readonly from: CivilDate
  readonly share: Percent
}

/** Whether a part is one you can hold: above 0% and at most all of it. */
export function isPartOfWhole(share: Percent): boolean {
  return share > 0 && share <= WHOLE
}

/** Whether the part is all of it, which a record keeps as no part. */
export function isWhole(share: Percent): boolean {
  return share === WHOLE
}

/** Whether you own or owe something with others at any time: a part under all of it from the start, or any dated change of part. */
export function isShared(fromStart: Percent | undefined, changes: readonly PartChange[]): boolean {
  return (fromStart !== undefined && !isWhole(fromStart)) || changes.length > 0
}

/** Your part on the day: the latest change on or before it, else the part from the start. Null when it is all yours. */
export function partOnDay(fromStart: Percent | undefined, changes: readonly PartChange[], day: CivilDate): Percent | null {
  const latest = changes.reduce<PartChange | null>((held, change) => (change.from <= day && (held === null || change.from > held.from) ? change : held), null)
  const part = latest?.share ?? fromStart ?? WHOLE
  return part === WHOLE ? null : part
}

/** Your part of an amount, rounded once to the cent, or the whole amount when it is all yours. */
export function yourPartOf(whole: Money, part: Percent | null): Money {
  return part === null ? whole : moneyAt(whole, part)
}

/** Why a dated change of a part cannot stand: it is from before the start of what it is a part of, or from a day another change is from too. */
export type PartChangeDoubt = 'before-start' | 'same-day'

/** The doubt a part change carries, or null when it stands. A start of null, such as an asset with no day bought, takes any day. */
export function partChangeDoubt(from: CivilDate, start: CivilDate | null, dayTaken: boolean): PartChangeDoubt | null {
  if (start !== null && from < start) return 'before-start'
  return dayTaken ? 'same-day' : null
}

/** A part typed into a field, such as 50, 33,33 or 33.33 %. Null for anything that is not above 0% and at most 100% to the basis point, blank included. */
export function typedPart(text: string): Percent | null {
  const match = TYPED_PART.exec(text.trim())
  if (match === null) return null
  const part = percentFromWritten(Number(`${match[1]}.${match[2] ?? '0'}`))
  return part !== null && isPartOfWhole(part) ? part : null
}

/** A part as its field shows it, with the language's decimal mark, so `typedPart` reads it back. Blank for none. */
export function partShown(part: Percent | undefined): string {
  return part === undefined ? '' : String(writtenPercent(part)).replace('.', AMOUNT_SEPARATORS[language].decimal)
}

/** What a part change's fields hold while they are typed. */
export interface PartChangeTexts {
  readonly from: string
  readonly share: string
}

/** What is wrong with each field of a part change, or null where nothing is. */
export interface PartChangeFaults {
  readonly from: 'no-date' | PartChangeDoubt | null
  readonly share: 'no-part' | null
}

/**
 * The day and part a change's fields give, as its dialog and the chat check them: a real day, not before the start of what it is a part of and
 * not one another change is from, and a part above 0% and at most 100%. The change is null while a field is wrong.
 */
export function typedPartChange(
  texts: PartChangeTexts,
  start: CivilDate | null,
  others: readonly { readonly id: string; readonly from: CivilDate }[],
  editing: string | null,
): { readonly faults: PartChangeFaults; readonly change: PartChange | null } {
  const from = parseCivilDate(texts.from)
  const share = typedPart(texts.share)
  const faults: PartChangeFaults = {
    from:
      from === null
        ? 'no-date'
        : partChangeDoubt(
            from,
            start,
            others.some((other) => other.from === from && other.id !== editing),
          ),
    share: share === null ? 'no-part' : null,
  }
  return { faults, change: faults.from === null && from !== null && share !== null ? { from, share } : null }
}
