import { rowDrill } from '../../../../filters/domain/drillTarget'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import { problemOf } from '../../../../../../shared/storage/domain/recordsRead'
import type { RecordProblem } from '../../../../../../shared/storage/domain/recordsRead'
import type { Asset } from './assets'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import type { Category, Transaction } from '../../../../workbook/domain/workbook'
import { daysBetween } from '../../../../../../shared/calendar/civilDate'
import { addMoney, negateMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { hasVersionOn, ruleValue } from '../../ruleset/ruleset'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { atRate } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

/** How an asset found its payment: its `ledger_reference` equals the row's reference or appears in its description, or the amount fits. */
export type AssetMatch = 'reference' | 'description' | 'date-and-amount'

export interface AssetPayment {
  readonly row: Transaction
  readonly matchedBy: AssetMatch
  readonly drill: DrillTarget
}

export interface RegisteredAsset {
  readonly asset: Asset
  /** Null when no ledger row could be found for it. */
  readonly payment: AssetPayment | null
}

export interface UnmatchedPurchase {
  readonly row: Transaction
  readonly drill: DrillTarget
}

/** A payment that assets claim by their `ledger_reference` although their net costs, with or without VAT at the standard rate, do not add up to it. */
export interface MismatchedPayment {
  readonly row: Transaction
  /** In the order of the assets tab. */
  readonly assets: readonly Asset[]
  /** The claiming assets' net costs added up. */
  readonly costNet: Money
  readonly drill: DrillTarget
}

/** A bank row an asset would claim, left unclaimed since no standard VAT rate is in force on its day to check its amount against. */
export interface UncheckedClaim {
  readonly asset: Asset
  readonly row: Transaction
  readonly matchedBy: AssetMatch
}

export interface AssetRegister {
  /** In the order of the assets tab. */
  readonly assets: readonly RegisteredAsset[]
  /** In the order of the assets tab. */
  readonly uncheckedClaims: readonly UncheckedClaim[]
  /** Debits on a `capital-purchase` category that no asset claims, such as small inventory, oldest first. */
  readonly unmatchedPurchases: readonly UnmatchedPurchase[]
  /** Oldest first. */
  readonly mismatchedPayments: readonly MismatchedPayment[]
  /** Empty when no category carries the role, so a screen can say why nothing matched by amount. */
  readonly capitalPurchaseCategories: readonly string[]
}

/**
 * Each asset matched to the debit that paid for it. A `ledger_reference` is looked for on every
 * debit, first as the row's reference and then inside its description, because older rows carry no
 * reference. An asset left over takes an unclaimed `capital-purchase` debit of its net cost, or of
 * its net cost with VAT at the standard rate, nearest to the day it was bought. A payment the
 * references claim is reported when it is not what the claiming assets cost in the same way. A row
 * dated before the ruleset knows a standard VAT rate is never claimed, and the asset that would
 * claim it says so.
 */
export function assetRegister(
  assets: readonly Asset[],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  rules: RuleSource = ruleValue,
): AssetRegister {
  const capitalPurchaseCategories = categoriesWithRole(categories, PACK_ROLES.capitalPurchase)
  const debits = oldestFirst(transactions.filter((row) => row.amount < 0))
  const found = assets.map((asset) => referenceMatch(asset, debits))
  const byReference = found.map((payment) => (payment !== null && vatRateKnown(payment.row) ? payment : null))
  const uncheckedClaims: UncheckedClaim[] = []

  const claimed = new Set(byReference.flatMap((payment) => (payment === null ? [] : [payment.row])))
  const purchases = debits.filter((row) => capitalPurchaseCategories.includes(row.category))
  const registered = assets.map((asset, position): RegisteredAsset => {
    const referenced = found[position] ?? null
    if (referenced !== null) {
      const known = byReference[position] ?? null
      if (known === null) {
        uncheckedClaims.push({ asset, row: referenced.row, matchedBy: referenced.matchedBy })
      }
      return { asset, payment: known }
    }
    const open = purchases.filter((row) => !claimed.has(row))
    const row = nearestTo(asset, open.filter((candidate) => vatRateKnown(candidate) && paysFor(candidate, asset.costNet, rules)))
    if (row === null) {
      const unchecked = nearestTo(asset, open.filter((candidate) => !vatRateKnown(candidate)))
      if (unchecked !== null) {
        uncheckedClaims.push({ asset, row: unchecked, matchedBy: 'date-and-amount' })
      }
      return { asset, payment: null }
    }
    claimed.add(row)
    return { asset, payment: { row, matchedBy: 'date-and-amount', drill: rowDrill(row) } }
  })

  return {
    assets: registered,
    uncheckedClaims,
    unmatchedPurchases: purchases.filter((row) => !claimed.has(row)).map((row) => ({ row, drill: rowDrill(row) })),
    mismatchedPayments: mismatchedPayments(assets, byReference, debits, rules),
    capitalPurchaseCategories,
  }
}

/**
 * The names of the assets that claim each bank row, by the row's record id, as the
 * register matches them. A split of such a row is refused, so the row counts whole.
 */
export function assetsClaimingRows(
  assets: readonly Asset[],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  rules: RuleSource = ruleValue,
): ReadonlyMap<RecordId, readonly string[]> {
  const claiming = new Map<RecordId, string[]>()
  for (const { asset, payment } of assetRegister(assets, transactions, categories, rules).assets) {
    if (payment !== null) {
      claiming.set(payment.row.id, [...(claiming.get(payment.row.id) ?? []), asset.name])
    }
  }
  return claiming
}

/** A problem on each asset that claims no row it would otherwise claim, naming the row's day and the VAT rate the ruleset lacks for it. */
export function uncheckedClaimProblems(assets: readonly Asset[], transactions: readonly Transaction[], categories: readonly Category[]): RecordProblem[] {
  return assetRegister(assets, transactions, categories).uncheckedClaims.map(({ asset, row, matchedBy }) => {
    const found = matchedBy === 'date-and-amount' ? `the capital purchase of ${row.date} may pay for it` : `its ledger_reference finds the bank row of ${row.date}`
    return problemOf({ id: asset.id, label: asset.name }, `${found}, but the app has no standard VAT rate for that day to check the amount against, so the row is left unclaimed`)
  })
}

function mismatchedPayments(assets: readonly Asset[], byReference: readonly (AssetPayment | null)[], debits: readonly Transaction[], rules: RuleSource): MismatchedPayment[] {
  return debits.flatMap((row) => {
    const claiming = assets.filter((_, position) => byReference[position]?.row === row)
    if (claiming.length === 0) {
      return []
    }
    const costNet = sumMoney(claiming.map((asset) => asset.costNet))
    return paysFor(row, costNet, rules) ? [] : [{ row, assets: claiming, costNet, drill: rowDrill(row) }]
  })
}

function referenceMatch(asset: Asset, debits: readonly Transaction[]): AssetPayment | null {
  const reference = normalised(asset.ledgerReference)
  if (reference === '') {
    return null
  }
  const exact = nearestTo(asset, debits.filter((row) => normalised(row.reference) === reference))
  if (exact !== null) {
    return { row: exact, matchedBy: 'reference', drill: rowDrill(exact) }
  }
  const described = nearestTo(asset, debits.filter((row) => normalised(row.description).includes(reference)))
  return described === null ? null : { row: described, matchedBy: 'description', drill: rowDrill(described) }
}

function vatRateKnown(row: Transaction): boolean {
  return hasVersionOn('hr.vat.rates', row.date)
}

/** Whether the row paid the net cost, or the net cost with VAT at the standard rate. */
function paysFor(row: Transaction, costNet: Money, rules: RuleSource): boolean {
  const paid = negateMoney(row.amount)
  const standardRate = rules('hr.vat.rates', row.date).value.standardRate.basisPoints
  return paid === costNet || paid === addMoney(costNet, atRate(costNet, standardRate))
}

/** The row paid closest to the day the asset was bought, the earlier booking on a tie. */
function nearestTo(asset: Asset, rows: readonly Transaction[]): Transaction | null {
  return rows.reduce<Transaction | null>((best, row) => {
    if (best === null) {
      return row
    }
    return Math.abs(daysBetween(asset.bought, row.date)) < Math.abs(daysBetween(asset.bought, best.date)) ? row : best
  }, null)
}

function normalised(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function oldestFirst(rows: readonly Transaction[]): Transaction[] {
  return [...rows].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
}
