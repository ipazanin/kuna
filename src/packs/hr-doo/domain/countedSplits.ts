import type { LedgerSplit } from '../../../features/workbook/domain/splits'
import type { Workbook, WorkbookProblem } from '../../../features/workbook/domain/workbook'
import { ruleValue } from '../ruleset/ruleset'
import { assetsClaimingRows } from './assets/assetRegister'
import type { RuleSource } from './payroll/payrollArithmetic'

/** The splits the screens count, and why they leave out any the tab holds. */
export interface CountedSplits {
  readonly splits: readonly LedgerSplit[]
  readonly problems: readonly WorkbookProblem[]
}

/** The splits of the `splits` tab less those of a row an asset claims, which count whole since the asset register claims the whole payment. */
export function countedSplits(workbook: Workbook, rules: RuleSource = ruleValue): CountedSplits {
  const claiming = assetsClaimingRows(workbook.assets, workbook.transactions, workbook.categories, rules)
  const problems: WorkbookProblem[] = []
  const splits = workbook.splits.filter((split) => {
    const assets = claiming.get(split.row.sheetRow)
    if (assets === undefined) {
      return true
    }
    const reason = `${assets.map((name) => `"${name}"`).join(' and ')} on the assets tab ${assets.length === 1 ? 'claims' : 'claim'} ledger row ${split.row.sheetRow} as payment, so the row counts whole`
    problems.push(...split.parts.map((part) => ({ tab: 'splits' as const, sheetRow: part.sheetRow, reason })))
    return false
  })
  return { splits, problems }
}
