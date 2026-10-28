import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../../shared/money/money'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'

/** The `component` names of the `scenarios` tab. A tax-free item is written `nontaxable:<item>`, such as `nontaxable:occasional-gift`. */
export const SCENARIO_COMPONENTS = ['salary_gross', 'nontaxable', 'rent_monthly', 'dividend', 'director_basis'] as const

/** How the owner is insured as the director: employed by the company, as a board member only, or employed elsewhere. */
export const DIRECTOR_BASES = ['employee', 'board-only', 'insured-elsewhere'] as const

export type DirectorBasis = (typeof DIRECTOR_BASES)[number]

interface ComponentSpan {
  /** The first day the component holds, or null for the start of the scenario's year. */
  readonly from: CivilDate | null
  /** The last day it holds, or null for the end of the year. */
  readonly to: CivilDate | null
  /** By its scenario, component and days. */
  readonly id: RecordId
}

/** One row of a scenario. */
export type ScenarioComponent = ComponentSpan &
  (
    | { readonly component: 'salary_gross'; readonly gross: Money | 'floor' }
    | { readonly component: 'nontaxable'; readonly item: string; readonly amount: Money }
    | { readonly component: 'rent_monthly'; readonly amount: Money }
    | { readonly component: 'dividend'; readonly amount: Money | 'max' }
    | { readonly component: 'director_basis'; readonly basis: DirectorBasis }
  )

/** A named owner pay mix for one year, from the rows of the `scenarios` tab that share its name. */
export interface OwnerPayScenario {
  readonly slug: string
  /** The label its rows give. Blank when none gives one or they differ. */
  readonly label: string
  readonly year: number
  /** In tab order. */
  readonly components: readonly ScenarioComponent[]
}
