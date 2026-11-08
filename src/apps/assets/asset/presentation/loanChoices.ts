import type { LoansOnScreen } from '../../values/presentation/assetsOnDay'
import type { Asset } from '../../workbook/domain/asset'
import type { AssetBook } from '../../workbook/domain/readAssetBook'
import { words } from './words'

/** What the loan select holds for no loan, since a select's value cannot be empty. */
export const NO_LOAN = 'none'

export interface LoanChoice {
  readonly label: string
  readonly value: string
}

/**
 * The loans the asset dialog offers: No loan first, then each bank loan Loans lists that no other asset names, since a
 * loan goes on one asset. The loan the asset names stays offered, as not in Loans now while Loans does not list it, so
 * a save keeps it.
 */
export function loanChoices(loans: LoansOnScreen, book: Pick<AssetBook, 'assets'>, editing: Asset | null): LoanChoice[] {
  const listed = Array.isArray(loans) ? loans : []
  const taken = new Set(book.assets.flatMap(({ asset }) => (asset.id === editing?.id || asset.loan === null ? [] : [asset.loan])))
  const own = editing?.loan ?? null
  return [
    { label: words.assetDialog.noLoan, value: NO_LOAN },
    ...listed.filter((loan) => !taken.has(loan.key) || loan.key === own).map((loan) => ({ label: loan.name, value: loan.key })),
    ...(own === null || listed.some((loan) => loan.key === own) ? [] : [{ label: words.assetDialog.notInLoans, value: own }]),
  ]
}

/** Why no loan can be picked or taken off, or an empty text while Loans lists its bank loans. */
export function loanReasonOf(loans: LoansOnScreen): string {
  return loans === null ? words.assetDialog.loansNotSetUp : loans === 'opening' ? words.assetDialog.loansOpening : loans === 'failed' ? words.assetDialog.loansFailed : ''
}
