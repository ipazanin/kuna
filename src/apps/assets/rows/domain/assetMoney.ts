import type { AssetWithValuations } from '../../workbook/domain/readAssetBook'
import type { Valuation } from '../../workbook/domain/valuation'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMoney, negateMoney, ratioOf, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Share } from '../../../../shared/money/percent'
import { partOnDay, yourPartOf } from '../../../../shared/money/yourPart'

/** How the app that keeps a row counts the money linked to an asset: as spending, as income, as saved, as the asset bought, or in no figure. */
export type AssetRowCounts = 'spending' | 'income' | 'saved' | 'bought' | 'nowhere'

/** A part of a row of your accounts linked to an asset, as the app that keeps the row counts it. */
export interface AssetRow {
  /** The asset's bare UUID. */
  readonly asset: string
  readonly day: CivilDate
  /** Signed as the row is, money out below zero, or null while the rates do not reach its day. */
  readonly euros: Money | null
  readonly counts: AssetRowCounts
}

/** The rows linked to assets, or unchecked while an app that links rows cannot be read. */
export type AssetRows = readonly AssetRow[] | 'unchecked'

/** What you paid for an asset from your accounts, and how many of its rows wait on rates and are left out. */
export interface PaidFromAccounts {
  readonly paid: Money
  readonly unrated: number
}

/**
 * What the rows linked to the asset as its purchase paid for it: money out adds and a refund takes off. Null when no row is
 * linked as its purchase, and unchecked while the linked rows cannot be read.
 */
export function paidFromAccounts(rows: AssetRows, asset: string): PaidFromAccounts | 'unchecked' | null {
  if (rows === 'unchecked') return 'unchecked'
  const bought = rows.filter((row) => row.asset === asset && row.counts === 'bought')
  if (bought.length === 0) return null
  const rated = bought.flatMap((row) => (row.euros === null ? [] : [negateMoney(row.euros)]))
  return { paid: sumMoney(rated), unrated: bought.length - rated.length }
}

/** What an asset's linked rows earned and cost in a year, in euros, with how many wait on rates and are left out. */
export interface YearOfAsset {
  readonly year: number
  /** Money in counted as income. */
  readonly earned: Money
  /** Money out counted as spending, less refunds, signed as money out is, below zero. */
  readonly cost: Money
  /** What it earned less what it cost, below zero for a year it cost more. */
  readonly net: Money
  /** The net as a share of your part of the value in that year, null for the year so far or with no value in that year. */
  readonly share: Share | null
  readonly unrated: number
}

/** Each full year an asset's linked rows earned or cost money in, newest first, and the year so far, or null when no row falls in it. */
export interface AssetYears {
  readonly full: readonly YearOfAsset[]
  readonly soFar: YearOfAsset | null
}

/** The asset's records that give the value of your part of it in a year. */
export type HeldAsset = Pick<AssetWithValuations, 'asset' | 'valuations' | 'shares'>

/**
 * Your part of the asset's value in a year: the last valuation dated up to the end of that year, or the price paid when none is,
 * at your part on the year's last day. Null with neither.
 */
export function valueOfYourPartIn(held: HeldAsset, year: number): Money | null {
  const last = held.valuations.reduce<Valuation | null>((latest, valuation) => (yearOf(valuation.date) <= year && (latest === null || valuation.date >= latest.date) ? valuation : latest), null)
  const whole = last?.value ?? held.asset.price
  return whole === null ? null : yourPartOf(whole, partOnDay(held.asset.share, held.shares, civilDate(year, 12, 31)))
}

/**
 * What the rows linked to the asset as income from it and costs of it came to in each full year that holds one, newest first,
 * each net also as a share of your part of the value in that year, and in the year so far with no share. A full year is one
 * that ended before today. Null when no row is linked so, and unchecked while the linked rows cannot be read.
 */
export function yearlyNet(rows: AssetRows, asset: string, today: CivilDate, held: HeldAsset): AssetYears | 'unchecked' | null {
  if (rows === 'unchecked') return 'unchecked'
  const counted = rows.filter((row) => row.asset === asset && (row.counts === 'income' || row.counts === 'spending'))
  if (counted.length === 0) return null
  const thisYear = yearOf(today)
  const yearOfRows = (year: number, withShare: boolean): YearOfAsset => {
    const ofYear = counted.filter((row) => yearOf(row.day) === year)
    const sum = (counts: AssetRowCounts): Money => sumMoney(ofYear.flatMap((row) => (row.counts === counts && row.euros !== null ? [row.euros] : [])))
    const earned = sum('income')
    const cost = sum('spending')
    const net = addMoney(earned, cost)
    const value = withShare ? valueOfYourPartIn(held, year) : null
    return { year, earned, cost, net, share: value === null ? null : ratioOf(net, value), unrated: ofYear.filter((row) => row.euros === null).length }
  }
  const years = [...new Set(counted.map((row) => yearOf(row.day)))].sort((one, other) => other - one)
  return { full: years.filter((year) => year < thisYear).map((year) => yearOfRows(year, true)), soFar: years.includes(thisYear) ? yearOfRows(thisYear, false) : null }
}
