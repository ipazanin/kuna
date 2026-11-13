import { rowDrill } from '../../../../filters/domain/drillTarget'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import { problemOf } from '../../../../../../shared/storage/domain/recordsRead'
import type { RecordProblem } from '../../../../../../shared/storage/domain/recordsRead'
import type { Asset } from './assets'
import { recordIdOf } from '../../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { ITEM_RECORDS } from '../../../../workbook/domain/coreKinds'
import { wholeItemId } from '../../../../workbook/domain/splits'
import type { Category, Transaction, Workbook } from '../../../../workbook/domain/workbook'
import { daysBetween } from '../../../../../../shared/calendar/civilDate'
import { ZERO, addMoney, negateMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { moneyAt } from '../../../../../../shared/money/percent'
import { moneyParts } from '../../../../../../shared/money/decimal'
import { countedShareIn } from '../../../../owner-share/domain/ownerParts'
import { hasVersionOn, ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { vatKeptForPrivateShare, vatSplit } from '../vat/vatSplit'
import { netCostOf } from './depreciationSchedule'
import type { AssetCostOf } from './depreciationSchedule'
import { words } from './words'

/** How an asset found its payment: it names the row's item, its `ledger_reference` equals the row's reference or appears in its description, or the amount fits. */
export type AssetMatch = 'row' | 'reference' | 'description' | 'date-and-amount'

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

/** What each asset depreciates at, and the part of it that is VAT on the owner's private share. */
export interface AssetCosts {
  readonly costOf: AssetCostOf
  /** Positive, and zero for an asset whose cost holds no such VAT. */
  readonly privateShareVatOf: (asset: Asset) => Money
}

/**
 * What each asset depreciates at: its net cost, and its share of the VAT its payment cannot deduct,
 * such as the half of a personal car's VAT or the VAT on the owner's private share. Assets that
 * share a payment share that VAT by their net costs. An asset without a payment, or one these
 * books do not hold, depreciates at its net cost.
 */
export function assetCostsOf(workbook: Pick<Workbook, 'transactions' | 'categories' | 'settings'> & { readonly assets: readonly Asset[] }, rules: RuleSource = ruleValue): AssetCosts {
  const byPayment = new Map<Transaction, Asset[]>()
  for (const { asset, payment } of assetRegister(workbook.assets, workbook.transactions, workbook.categories, rules).assets) {
    if (payment !== null) {
      byPayment.set(payment.row, [...(byPayment.get(payment.row) ?? []), asset])
    }
  }
  const costs = new Map<Asset, TracedFigure>()
  const privateShareVat = new Map<Asset, Money>()
  for (const [row, claiming] of byPayment) {
    const category = workbook.categories.find((candidate) => candidate.slug === row.category)
    if (category === undefined) {
      continue
    }
    const split = vatSplit(row, category, countedShareIn(workbook, row), rules)
    const weights = claiming.map((asset) => BigInt(asset.costNet))
    const parts = moneyParts(negateMoney(split.kept.amount), weights)
    const privateParts = moneyParts(negateMoney(vatKeptForPrivateShare(split)), weights)
    claiming.forEach((asset, position) => {
      const part = parts[position] ?? ZERO
      privateShareVat.set(asset, privateParts[position] ?? ZERO)
      if (part !== 0) {
        const steps = [tracedFigure(words.schedule.costNet, asset.costNet, 'assets', []), tracedFigure(words.schedule.keptVat, part, 'ledger', split.kept.rules)]
        costs.set(asset, tracedFigure(words.schedule.cost, addMoney(asset.costNet, part), 'assets', split.kept.rules, steps))
      }
    })
  }
  return { costOf: (asset) => costs.get(asset) ?? netCostOf(asset), privateShareVatOf: (asset) => privateShareVat.get(asset) ?? ZERO }
}

/** The item an asset names as its payment: the one it names, or in books from before items the one item of the row it links. */
export function assetItemOf(asset: Pick<Asset, 'payment' | 'rowId'>): RecordId | null {
  return asset.payment ?? (asset.rowId === null ? null : recordIdOf(ITEM_RECORDS, asset.rowId))
}

/** The item a row as listed stands for: a part of a split row its own, and a row of one item that one. */
function itemIdOfRow(row: Pick<Transaction, 'id' | 'rowId' | 'split'>): RecordId {
  return row.split?.id ?? wholeItemId(row)
}

/** The debits whose item is this one, of which an asset naming it takes the one paid nearest the day it was bought. */
export function paymentRowsOf<Row extends Pick<Transaction, 'amount' | 'id' | 'rowId' | 'split'>>(item: RecordId, transactions: readonly Row[]): Row[] {
  return transactions.filter((row) => row.amount < 0 && itemIdOfRow(row) === item)
}

/**
 * Each asset matched to the debit that paid for it. An asset that names an item takes the debit of
 * that item and nothing else, as a person linked it. Without one, a `ledger_reference` is looked for on every
 * debit, first as the row's reference and then inside its description, because older rows carry no
 * reference. An asset left over takes an unclaimed `capital-purchase` debit of its net cost, or of
 * its net cost with VAT at the standard rate, nearest to the day it was bought. A payment the
 * references claim is reported when it is not what the claiming assets cost in the same way. A row
 * dated before the ruleset knows a standard VAT rate is never claimed, and the asset that would
 * claim it says so.
 */
export function assetRegister(assets: readonly Asset[], transactions: readonly Transaction[], categories: readonly Category[], rules: RuleSource = ruleValue): AssetRegister {
  const capitalPurchaseCategories = categoriesWithRole(categories, PACK_ROLES.capitalPurchase)
  const debits = oldestFirst(transactions.filter((row) => row.amount < 0))
  const linked = assets.map((asset) => linkedPayment(asset, debits))
  const found = assets.map((asset) => (assetItemOf(asset) === null ? referenceMatch(asset, debits) : null))
  const byReference = found.map((payment) => (payment !== null && vatRateKnown(payment.row) ? payment : null))
  const uncheckedClaims: UncheckedClaim[] = []

  const claimed = new Set([...linked, ...byReference].flatMap((payment) => (payment === null ? [] : [payment.row])))
  const purchases = debits.filter((row) => capitalPurchaseCategories.includes(row.category))
  const registered = assets.map((asset, position): RegisteredAsset => {
    if (assetItemOf(asset) !== null) {
      return { asset, payment: linked[position] ?? null }
    }
    const referenced = found[position] ?? null
    if (referenced !== null) {
      const known = byReference[position] ?? null
      if (known === null) {
        uncheckedClaims.push({ asset, row: referenced.row, matchedBy: referenced.matchedBy })
      }
      return { asset, payment: known }
    }
    const open = purchases.filter((row) => !claimed.has(row))
    const row = nearestTo(
      asset,
      open.filter((candidate) => vatRateKnown(candidate) && paysFor(candidate, asset.costNet, rules)),
    )
    if (row === null) {
      const unchecked = nearestTo(
        asset,
        open.filter((candidate) => !vatRateKnown(candidate)),
      )
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

/**
 * Each asset not yet linked whose `ledger_reference` finds exactly one debit, which the register claims for it and whose amount
 * fits, with that row's id, so the asset can be linked to the row it already counts.
 */
export function assetsToLink(assets: readonly Asset[], transactions: readonly Transaction[], categories: readonly Category[]): readonly { readonly asset: Asset; readonly rowId: string }[] {
  const register = assetRegister(assets, transactions, categories)
  const debits = transactions.filter((row) => row.amount < 0)
  const mismatched = new Set(register.mismatchedPayments.map((payment) => payment.row))
  return register.assets.flatMap(({ asset, payment }) => {
    if (assetItemOf(asset) !== null || payment === null || payment.row.rowId === null || mismatched.has(payment.row)) return []
    const { rows } = referencedRows(asset, debits)
    return rows.length === 1 && rows[0] === payment.row ? [{ asset, rowId: payment.row.rowId }] : []
  })
}

/**
 * A problem on each asset that claims no row it would otherwise claim, naming the row's day and the VAT rate the ruleset lacks for
 * it, and on each asset whose `row_id` no debit of the ledger carries.
 */
export function assetPaymentProblems(assets: readonly Asset[], transactions: readonly Transaction[], categories: readonly Category[]): RecordProblem[] {
  const unchecked = assetRegister(assets, transactions, categories).uncheckedClaims.map(({ asset, row, matchedBy }) =>
    problemOf({ id: asset.id, label: asset.name }, words.unchecked(matchedBy === 'date-and-amount', row.date)),
  )
  const unlinked = assets.flatMap((asset) => {
    const item = assetItemOf(asset)
    return item !== null && paymentRowsOf(item, transactions).length === 0 ? [problemOf({ id: asset.id, label: asset.name }, words.noLinkedPayment(asset.rowId ?? item))] : []
  })
  return [...unchecked, ...unlinked]
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

function linkedPayment(asset: Asset, debits: readonly Transaction[]): AssetPayment | null {
  const item = assetItemOf(asset)
  const row = item === null ? null : nearestTo(asset, paymentRowsOf(item, debits))
  return row === null ? null : { row, matchedBy: 'row', drill: rowDrill(row) }
}

/** The debits an asset's `ledger_reference` finds: those with it as their reference, or failing any, those with it inside their description. */
function referencedRows(asset: Asset, debits: readonly Transaction[]): { readonly rows: readonly Transaction[]; readonly matchedBy: 'reference' | 'description' } {
  const reference = normalised(asset.ledgerReference)
  if (reference === '') {
    return { rows: [], matchedBy: 'reference' }
  }
  const exact = debits.filter((row) => normalised(row.reference) === reference)
  return exact.length > 0 ? { rows: exact, matchedBy: 'reference' } : { rows: debits.filter((row) => normalised(row.description).includes(reference)), matchedBy: 'description' }
}

function referenceMatch(asset: Asset, debits: readonly Transaction[]): AssetPayment | null {
  const { rows, matchedBy } = referencedRows(asset, debits)
  const row = nearestTo(asset, rows)
  return row === null ? null : { row, matchedBy, drill: rowDrill(row) }
}

function vatRateKnown(row: Transaction): boolean {
  return hasVersionOn('hr.vat.rates', row.date)
}

/** Whether the row paid the net cost, or the net cost with VAT at the standard rate. */
function paysFor(row: Transaction, costNet: Money, rules: RuleSource): boolean {
  const paid = negateMoney(row.amount)
  const standardRate = rules('hr.vat.rates', row.date).value.standardRate.basisPoints
  return paid === costNet || paid === addMoney(costNet, moneyAt(costNet, standardRate))
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
