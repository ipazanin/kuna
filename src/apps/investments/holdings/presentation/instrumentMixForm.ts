import { words } from './words'
import type { FundMixLine } from '../../workbook/domain/fundMix'
import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import { FUND_MIXES, SECTORS, countryOf } from '../../workbook/domain/mixGroup'
import type { FundMixGroup } from '../../workbook/domain/mixGroup'
import { DECIMAL_ZERO, decimalShown, sumDecimal, typedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

export type FundMix = FundMixGroup['mix']

/** One line of a fund's mix as its fields hold it. */
export interface MixLineTexts {
  /** Unique within the dialog, so a removed line takes its fields with it. */
  readonly key: number
  group: string
  percent: string
}

export type FundMixTexts = Record<FundMix, MixLineTexts[]>

export interface MixLineErrors {
  readonly group: string | null
  readonly percent: string | null
}

export interface FundMixErrors {
  readonly lines: Readonly<Record<FundMix, readonly MixLineErrors[]>>
  /** Why a mix with lines does not add up to 100%, or null. */
  readonly whole: Readonly<Record<FundMix, string | null>>
}

let lastKey = 0

export function mixLineTexts(group: string, percent: string): MixLineTexts {
  lastKey += 1
  return { key: lastKey, group, percent }
}

/** The fund's lines of each mix, in the order the file holds them. */
export function fundMixTexts(lines: readonly FundMixLine[]): FundMixTexts {
  const of = (mix: FundMix): MixLineTexts[] => lines.filter((line) => line.slice.mix === mix).map((line) => mixLineTexts(line.slice.group, decimalShown(line.percent)))
  return { sector: of('sector'), country: of('country') }
}

function percentOf(text: string): Decimal | null {
  const percent = typedDecimal(text)
  return percent === null || percent === DECIMAL_ZERO || percent > HUNDRED_PERCENT ? null : percent
}

/** What the typed percents add up to, a blank or unreadable percent counted as none. */
export function mixSum(lines: readonly MixLineTexts[]): Decimal {
  return sumDecimal(lines.map((line) => percentOf(line.percent) ?? DECIMAL_ZERO))
}

function lineErrors(lines: readonly MixLineTexts[]): MixLineErrors[] {
  const text = words.instrumentDialog.errors
  return lines.map((line, index) => ({
    group: line.group === '' ? text.mixGroup : lines.some((other, at) => at < index && other.group === line.group) ? text.mixGroupTwice : null,
    percent: percentOf(line.percent) === null ? text.mixPercent : null,
  }))
}

export function fundMixErrors(texts: FundMixTexts): FundMixErrors {
  const whole = (mix: FundMix): string | null => (texts[mix].length === 0 || mixSum(texts[mix]) === HUNDRED_PERCENT ? null : words.instrumentDialog.errors.mixWhole)
  return {
    lines: { sector: lineErrors(texts.sector), country: lineErrors(texts.country) },
    whole: { sector: whole('sector'), country: whole('country') },
  }
}

export function mixHasErrors(errors: FundMixErrors, mix: FundMix): boolean {
  return errors.whole[mix] !== null || errors.lines[mix].some((line) => line.group !== null || line.percent !== null)
}

function sliceOf(mix: FundMix, group: string): FundMixGroup | null {
  if (mix === 'country') {
    const country = countryOf(group)
    return country === null ? null : { mix, group: country }
  }
  const sector = SECTORS.find((candidate) => candidate === group)
  return sector === undefined ? null : { mix, group: sector }
}

/** A mix the fields change: the instrument's lines of it held now, and the lines wanted in their place. */
export interface MixChange {
  readonly held: readonly FundMixLine[]
  readonly wanted: readonly Omit<FundMixLine, 'id'>[]
}

/** The mixes whose lines differ from those held, or null while a field has an error. */
export function fundMixChanges(texts: FundMixTexts, held: readonly FundMixLine[], instrument: RecordId): MixChange[] | null {
  const errors = fundMixErrors(texts)
  if (FUND_MIXES.some((mix) => mixHasErrors(errors, mix))) return null
  return FUND_MIXES.flatMap((mix) => {
    const heldOfMix = held.filter((line) => line.slice.mix === mix)
    const wanted = texts[mix].map((line) => ({ instrument, slice: sliceOf(mix, line.group)!, percent: percentOf(line.percent)! }))
    const same = wanted.length === heldOfMix.length && wanted.every((line, index) => line.slice.group === heldOfMix[index]!.slice.group && line.percent === heldOfMix[index]!.percent)
    return same ? [] : [{ held: heldOfMix, wanted }]
  })
}
