import type { HouseIndexState } from '../../houseIndex/presentation/useHouseIndex'
import type { AssetLoan } from '../../loans/application/assetLoans'
import type { Asset } from '../../workbook/domain/asset'
import type { AssetBook, AssetWithValuations } from '../../workbook/domain/readAssetBook'
import type { Valuation } from '../../workbook/domain/valuation'
import { assetValueOn, isEstimate, needsHouseIndex } from '../domain/assetValue'
import type { AssetValue } from '../domain/assetValue'
import { equityOf } from '../domain/equity'
import type { Equity } from '../domain/equity'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** The bank loans as Assets has them on screen: the list, a wait while Loans opens, a failure, or null while Loans is not set up. */
export type LoansOnScreen = readonly AssetLoan[] | 'opening' | 'failed' | null

/**
 * How the loan an asset names stands: none named or Loans not set up, another asset naming it too, Loans still opening
 * or failed, the loan gone from Loans, or the loan.
 */
export type LoanLink = { readonly kind: 'none' | 'shared' | 'opening' | 'failed' | 'gone' } | { readonly kind: 'linked'; readonly loan: AssetLoan }

/** An asset on the day: its value and how it was reached, its loan, and what is counted and yours. */
export interface AssetOnDay {
  readonly asset: Asset
  readonly valuations: readonly Valuation[]
  readonly value: AssetValue | null
  readonly link: LoanLink
  readonly equity: Equity
}

function linkOf({ asset, loanShared }: AssetWithValuations, loans: LoansOnScreen): LoanLink {
  if (asset.loan === null || loans === null) return { kind: 'none' }
  if (loanShared) return { kind: 'shared' }
  if (typeof loans === 'string') return { kind: loans }
  const loan = loans.find((candidate) => candidate.key === asset.loan)
  return loan === undefined ? { kind: 'gone' } : { kind: 'linked', loan }
}

/** Every asset of the book on the day, in the file's order. A house price index still loading or failed carries nothing. */
export function assetsOnDay(book: Pick<AssetBook, 'assets'>, day: CivilDate, index: HouseIndexState, loans: LoansOnScreen): AssetOnDay[] {
  const inHand = typeof index === 'object' ? index : null
  return book.assets.map((entry) => {
    const { asset, valuations } = entry
    const value = assetValueOn(asset, valuations, day, inHand)
    const link = linkOf(entry, loans)
    return { asset, valuations, value, link, equity: equityOf(value?.cents ?? null, link.kind === 'linked' ? link.loan : null) }
  })
}

/** What the assets add up to on the day: their value, whether it includes an estimate, what is yours after each loan that is known, how many have no value, and whether a home's region waited on an index that failed. */
export interface AssetsTotal {
  readonly value: Money
  readonly estimated: boolean
  readonly yoursAfter: readonly { readonly loan: AssetLoan; readonly yours: Money }[]
  readonly unvalued: number
  readonly indexFailed: boolean
}

/** The assets' total on the day, a wait while the house price index loads for a home with a region, or null for a file with no assets. */
export function assetsTotal(book: Pick<AssetBook, 'assets'>, day: CivilDate, index: HouseIndexState, loans: LoansOnScreen): AssetsTotal | 'opening' | null {
  if (book.assets.length === 0) return null
  const indexWanted = needsHouseIndex(book)
  if (indexWanted && index === 'loading') return 'opening'
  const assets = assetsOnDay(book, day, index, loans)
  return {
    value: sumMoney(assets.map((entry) => entry.equity.value ?? ZERO)),
    estimated: assets.some((entry) => entry.value !== null && isEstimate(entry.value.basis)),
    yoursAfter: assets.flatMap(({ link, equity }) => (link.kind === 'linked' && equity.yours !== null ? [{ loan: link.loan, yours: equity.yours }] : [])),
    unvalued: assets.filter((entry) => entry.equity.value === null).length,
    indexFailed: indexWanted && index === 'failed',
  }
}
