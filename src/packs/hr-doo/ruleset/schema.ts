import { parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { moneyFromCents } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { ActId } from './acts'

/** A rate as a whole number of basis points: 10% is 1000, 16.5% is 1650, a coefficient of 0.65 is 6500. */
export type Rate = number & { readonly __unit: 'basis-points' }

export interface RateTerm {
  readonly kind: 'rate'
  readonly basisPoints: Rate
}

export interface MoneyTerm {
  readonly kind: 'money'
  readonly cents: Money
}

/** A whole number, such as months, days, kilometres or a calendar year. */
export interface CountTerm {
  readonly kind: 'count'
  readonly count: number
}

export interface FlagTerm {
  readonly kind: 'flag'
  readonly holds: boolean
}

/** A key or a choice the law names, such as a country, a city or an asset group. */
export interface TextTerm {
  readonly kind: 'text'
  readonly text: string
}

export type ScalarTerm = RateTerm | MoneyTerm | CountTerm | FlagTerm | TextTerm

export type TableRow = Readonly<Record<string, ScalarTerm>>

/** Rows of named terms, such as tax brackets, per diem rates by country or depreciation groups. */
export interface TableTerm<Row extends TableRow = TableRow> {
  readonly kind: 'table'
  readonly rows: readonly Row[]
}

export type Term = ScalarTerm | TableTerm

/** The value of one rule version. Every number carries its unit, so a screen can print any rule. */
export type RuleTerms = Readonly<Record<string, Term>>

export function basisPoints(points: number): RateTerm {
  if (!Number.isInteger(points) || points < 0) {
    throw new RangeError(`${points} is not a whole number of basis points.`)
  }
  return { kind: 'rate', basisPoints: points as Rate }
}

export function cents(amount: number): MoneyTerm {
  return { kind: 'money', cents: moneyFromCents(amount) }
}

export function count(whole: number): CountTerm {
  if (!Number.isInteger(whole)) {
    throw new RangeError(`${whole} is not a whole number.`)
  }
  return { kind: 'count', count: whole }
}

export function flag(holds: boolean): FlagTerm {
  return { kind: 'flag', holds }
}

export function text(wording: string): TextTerm {
  if (wording.trim() === '') {
    throw new RangeError('A text term needs wording.')
  }
  return { kind: 'text', text: wording }
}

export function table<Row extends TableRow>(rows: readonly Row[]): TableTerm<Row> {
  if (rows.length === 0) {
    throw new RangeError('A table term needs at least one row.')
  }
  return { kind: 'table', rows }
}

/** A `YYYY-MM-DD` date written in the ruleset. A day that does not exist fails when the module loads. */
export function day(written: string): CivilDate {
  const date = parseCivilDate(written)
  if (date === null) {
    throw new RangeError(`${written} is not a calendar day.`)
  }
  return date
}

export type Confidence =
  /** Read in the Narodne novine text. */
  | 'confirmed-nn'
  /** Read in the zakon.hr consolidated text, with the amendment list checked. */
  | 'confirmed-consolidated'
  /** Read in a table the tax administration compiles from the texts in the Narodne novine. */
  | 'confirmed-table'
  /** The text was loaded, and its application to the company is an interpretation. */
  | 'reading'
  /** The accountant's own figures apply it and match to the cent. */
  | 'practice'
  /** Derived before the official figure exists. */
  | 'estimate'
  /** In a bill or draft not yet enacted. */
  | 'pending'
  /** Not loaded or not confirmed, never used as a fact. */
  | 'unconfirmed'

export type WatchedConfidence = Extract<Confidence, 'estimate' | 'pending' | 'unconfirmed'>

/** Versions with these marks are due to change or to be checked, so the Ruleset screen lists them. */
export function isWatchedConfidence(confidence: Confidence): confidence is WatchedConfidence {
  return confidence === 'estimate' || confidence === 'pending' || confidence === 'unconfirmed'
}

export type RuleArea = 'profit-tax' | 'owner-pay' | 'accounting' | 'vat' | 'company-law'

/** Which date picks a rule's version: the tax period's first day, the payment date, the supply date or the event's date. */
export type AppliesBy = 'tax-period' | 'month-worked' | 'payment-date' | 'supply-date' | 'event-date'

export interface LegalSource {
  readonly act: ActId
  /** The NN issues that set this wording, not the whole history of the act. */
  readonly nn: readonly string[]
  /** Without the `Art.` prefix: `28`, `7(1)(3)`, `90.h`, `7(2) item 31`, `15.27`, or a list such as `12(16) to 12(21)`. */
  readonly article: string
  /** The article belongs to the amending act in `nn`, such as a transitional rule, not to the consolidated act. */
  readonly ofAmendingAct?: true
  /** The page that was loaded. */
  readonly url: string
  readonly loadedOn: CivilDate
  /** The Croatian wording, so the screen can show it without a fetch. */
  readonly quote?: string
}

export interface RuleVersion<Value> {
  /** Inclusive. */
  readonly validFrom: CivilDate
  /** Inclusive, null while open-ended. */
  readonly validTo: CivilDate | null
  readonly value: Value
  readonly sources: readonly LegalSource[]
  readonly confidence: Confidence
  /** Required for a watched mark: what is unknown and what would settle it. */
  readonly note?: string
}

export interface Rule<Id extends string, Value> {
  readonly id: Id
  readonly area: RuleArea
  /** A short English name for the screen. */
  readonly title: string
  readonly appliesBy: AppliesBy
  /** In date order, each starting the day after the previous one ends. */
  readonly versions: readonly RuleVersion<Value>[]
}

/** Every rule an area's value map declares, each typed by its own value. */
export type RuleIn<Values extends Record<keyof Values, RuleTerms>> = {
  readonly [Id in keyof Values & string]: Rule<Id, Values[Id]>
}[keyof Values & string]

export type GeneralRule = Rule<string, RuleTerms>

/** A watched matter with no value in the ruleset yet: a bill, a draft, or a levy whose facts are unknown. */
export interface OpenItem {
  readonly id: string
  readonly area: RuleArea
  readonly title: string
  readonly status: WatchedConfidence
  /** What is unknown and what would settle it. */
  readonly note: string
  readonly url: string | null
}

/** The rule and version a figure rests on, as a source chip shows it. */
export interface RuleCitation {
  readonly ruleId: string
  readonly validFrom: CivilDate
  readonly validTo: CivilDate | null
  readonly sources: readonly LegalSource[]
  readonly confidence: Confidence
}
