import { daysBetween } from '../../../shared/calendar/civilDate'
import { addMoney, negateMoney } from '../../../shared/money/money'
import type { LedgerSplit } from '../../../features/workbook/domain/splits'
import type { Category, PrivateShareToMove, Transaction, Workbook, WorkbookProblem } from '../../../features/workbook/domain/workbook'
import { ruleValue } from '../ruleset/ruleset'
import { assetsClaimingRows } from './assets/assetRegister'
import type { RuleSource } from './payroll/payrollArithmetic'
import { PACK_ROLES } from './packRoles'

/** How many days from the advance's own day its payment may be booked, since an advance carries the card's day and the bank books a day or two later. */
export const SHARE_DAYS = 3

/** The splits the screens count, and why they leave out any the tab holds. */
export interface CountedSplits {
  readonly splits: readonly LedgerSplit[]
  readonly problems: readonly WorkbookProblem[]
}

/**
 * The splits of the `splits` tab less those of a row an asset claims, which count whole since the
 * asset register claims the whole payment. Each private share still on the owner-advances tab
 * counts as the split "Move to splits" would write for it, so no figure changes when it is moved.
 * A share that no single bank row matches counts nowhere and is reported.
 */
export function countedSplits(workbook: Workbook, rules: RuleSource = ruleValue): CountedSplits {
  const claiming = assetsClaimingRows(workbook.assets, workbook.transactions, workbook.categories, rules)
  const problems: WorkbookProblem[] = []
  const kept = workbook.splits.filter((split) => {
    const assets = claiming.get(split.row.sheetRow)
    if (assets === undefined) {
      return true
    }
    const reason = `${assets.map((name) => `"${name}"`).join(' and ')} on the assets tab ${assets.length === 1 ? 'claims' : 'claim'} ledger row ${split.row.sheetRow} as payment, so the row counts whole`
    problems.push(...split.parts.map((part) => ({ tab: 'splits' as const, sheetRow: part.sheetRow ?? 0, reason })))
    return false
  })

  const privateCategory = privateShareCategories(workbook.categories)[0]
  if (privateCategory === undefined) {
    const reason = 'no category carries the owner-loan-out role, so the private share counts nowhere until one does'
    return { splits: kept, problems: [...problems, ...workbook.privateSharesToMove.map((share) => ({ tab: 'owner-advances' as const, sheetRow: share.sheetRow, reason }))] }
  }
  const matched = workbook.privateSharesToMove.map((share) => ({ share, candidates: privateShareCandidates(workbook, share, claiming) }))
  const shares = matched.flatMap(({ share, candidates }) => {
    const reason = unmatchedReason(share, candidates, matched)
    if (reason !== null) {
      problems.push({ tab: 'owner-advances', sheetRow: share.sheetRow, reason })
      return []
    }
    return [privateShareSplit(share, candidates[0]!, privateCategory)]
  })
  return { splits: [...kept, ...shares], problems }
}

/** Why a share counts nowhere: no single bank row matches it, or another share matches its row too. Null when it can count. */
function unmatchedReason(
  share: PrivateShareToMove,
  candidates: readonly Transaction[],
  matched: readonly { readonly share: PrivateShareToMove; readonly candidates: readonly Transaction[] }[],
): string | null {
  if (candidates.length !== 1) {
    const found = candidates.length === 0 ? 'no ledger row' : `${candidates.length} ledger rows`
    return `${found} in ${share.category} within ${SHARE_DAYS} days of ${share.date} paid more than the share, so it counts nowhere until it is split by hand on Transactions`
  }
  const row = candidates[0]
  const shared = matched.some((other) => other.share !== share && other.candidates.length === 1 && other.candidates[0] === row)
  return shared ? `another private share matches ledger row ${row!.sheetRow} too, so neither counts until the row is split by hand on Transactions` : null
}

/** The categories a private share may move into: those whose rows the loan book counts as lent to the owner, in the order of the categories tab. */
export function privateShareCategories(categories: readonly Category[]): readonly Category[] {
  return categories.filter((category) => category.roles.includes(PACK_ROLES.ownerLoanOut))
}

/**
 * The bank rows a private share may have come off: debits in its category within three days of
 * its date that paid more than the share, none of them split on the splits tab or claimed by an asset.
 */
export function privateShareCandidates(
  workbook: Pick<Workbook, 'transactions' | 'splits' | 'assets' | 'categories'>,
  share: PrivateShareToMove,
  claiming: ReadonlyMap<number, readonly string[]> = assetsClaimingRows(workbook.assets, workbook.transactions, workbook.categories),
): readonly Transaction[] {
  const taken = new Set(workbook.splits.map((split) => split.row.sheetRow))
  return workbook.transactions.filter(
    (row) =>
      row.category === share.category &&
      row.amount < 0 &&
      negateMoney(row.amount) > share.amount &&
      Math.abs(daysBetween(share.date, row.date)) <= SHARE_DAYS &&
      !taken.has(row.sheetRow) &&
      !claiming.has(row.sheetRow),
  )
}

/** The split that moves a share onto its bank row: the company's part stays in the row's category, and the owner's part goes to the private category with the advance's description. */
export function privateShareSplit(share: PrivateShareToMove, row: Transaction, privateCategory: Category): LedgerSplit {
  return {
    row,
    parts: [
      { amount: addMoney(row.amount, share.amount), category: row.category, family: row.family, bucket: row.bucket, note: '', sheetRow: null },
      { amount: negateMoney(share.amount), category: privateCategory.slug, family: privateCategory.family, bucket: privateCategory.bucket, note: share.description, sheetRow: null },
    ],
  }
}
