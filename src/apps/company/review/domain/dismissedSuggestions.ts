import type { CoverageGroup, RuleCoverage } from '../../rules/domain/ruleCoverage'
import type { Dismissal, SuggestionKind } from '../../workbook/domain/dismissals'

/** A dismissal, with the group it hides today. The group is null once no row a person filed is left in it. */
export interface DismissedSuggestion<Row> {
  readonly dismissal: Dismissal
  readonly group: CoverageGroup<Row> | null
}

export interface ShownCoverage<Row> {
  /** The groups no dismissal hides. */
  readonly coverage: RuleCoverage<Row>
  readonly dismissed: readonly DismissedSuggestion<Row>[]
}

/**
 * Takes the dismissed groups out of the coverage. A dismissal names a group by its kind and its
 * key, the counterparty and for an exception the rule too, so it keeps the group hidden as new rows
 * join it, whatever their category.
 */
export function withoutDismissed<Row>(coverage: RuleCoverage<Row>, dismissals: readonly Dismissal[]): ShownCoverage<Row> {
  const groupsOf = (kind: SuggestionKind): readonly CoverageGroup<Row>[] => (kind === 'not-covered' ? coverage.notCovered : coverage.exceptions)
  const isDismissed = (kind: SuggestionKind, group: CoverageGroup<Row>): boolean =>
    dismissals.some((dismissal) => dismissal.kind === kind && dismissal.key === group.key)
  return {
    coverage: {
      notCovered: coverage.notCovered.filter((group) => !isDismissed('not-covered', group)),
      exceptions: coverage.exceptions.filter((group) => !isDismissed('exception', group)),
    },
    dismissed: dismissals.map((dismissal) => ({ dismissal, group: groupsOf(dismissal.kind).find((group) => group.key === dismissal.key) ?? null })),
  }
}
