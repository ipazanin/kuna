import { rowDrill } from '../../../../features/filters/domain/drillTarget'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import type { Asset } from '../../../../features/workbook/domain/assets'
import type { Category, Transaction } from '../../../../features/workbook/domain/workbook'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import { addMoney, negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
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

export interface AssetRegister {
  /** In the order of the assets tab. */
  readonly assets: readonly RegisteredAsset[]
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
 * references claim is reported when it is not what the claiming assets cost in the same way.
 */
export function assetRegister(
  assets: readonly Asset[],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  rules: RuleSource = ruleValue,
): AssetRegister {
  const capitalPurchaseCategories = categoriesWithRole(categories, PACK_ROLES.capitalPurchase)
  const debits = oldestFirst(transactions.filter((row) => row.amount < 0))
  const byReference = assets.map((asset) => referenceMatch(asset, debits))

  const claimed = new Set(byReference.flatMap((payment) => (payment === null ? [] : [payment.row])))
  const purchases = debits.filter((row) => capitalPurchaseCategories.includes(row.category))
  const registered = assets.map((asset, position): RegisteredAsset => {
    const known = byReference[position] ?? null
    if (known !== null) {
      return { asset, payment: known }
    }
    const fitting = purchases.filter((row) => !claimed.has(row) && paysFor(row, asset.costNet, rules))
    const row = nearestTo(asset, fitting)
    if (row === null) {
      return { asset, payment: null }
    }
    claimed.add(row)
    return { asset, payment: { row, matchedBy: 'date-and-amount', drill: rowDrill(row) } }
  })

  return {
    assets: registered,
    unmatchedPurchases: purchases.filter((row) => !claimed.has(row)).map((row) => ({ row, drill: rowDrill(row) })),
    mismatchedPayments: mismatchedPayments(assets, byReference, debits, rules),
    capitalPurchaseCategories,
  }
}

/**
 * The names of the assets that claim each bank row, by the row's place on the ledger, as the
 * register matches them. A split of such a row is refused, so the row counts whole.
 */
export function assetsClaimingRows(
  assets: readonly Asset[],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  rules: RuleSource = ruleValue,
): ReadonlyMap<number, readonly string[]> {
  const claiming = new Map<number, string[]>()
  for (const { asset, payment } of assetRegister(assets, transactions, categories, rules).assets) {
    if (payment !== null) {
      claiming.set(payment.row.sheetRow, [...(claiming.get(payment.row.sheetRow) ?? []), asset.name])
    }
  }
  return claiming
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
