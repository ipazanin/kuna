import { civilDate } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { accountingOpenItems, accountingRules } from './rules/accounting'
import type { AccountingValues } from './rules/accounting'
import { companyLawOpenItems, companyLawRules } from './rules/company-law'
import type { CompanyLawValues } from './rules/company-law'
import { ownerPayOpenItems, ownerPayRules } from './rules/owner-pay'
import type { OwnerPayValues } from './rules/owner-pay'
import { profitTaxOpenItems, profitTaxRules } from './rules/profit-tax'
import type { ProfitTaxValues } from './rules/profit-tax'
import { vatOpenItems, vatRules } from './rules/vat'
import type { VatValues } from './rules/vat'
import { day, isWatchedConfidence } from './schema'
import type { GeneralRule, OpenItem, Rule, RuleCitation, RuleIn, RuleTerms, RuleVersion } from './schema'

/** One value type per rule id, so `ruleValue('hr.cit.rate', …)` is typed. */
export type RuleValues = ProfitTaxValues & OwnerPayValues & AccountingValues & VatValues & CompanyLawValues

export type RuleId = keyof RuleValues & string

/** The day the rule texts were last checked against their sources. */
export const RULESET_CHECKED_ON = day('2026-10-18')

/** The first day the ruleset models. A version never starts earlier, even when its wording is older. */
export const RULESET_FIRST_DAY = day('2025-01-01')

export const RULES: readonly RuleIn<RuleValues>[] = [
  ...profitTaxRules,
  ...ownerPayRules,
  ...accountingRules,
  ...vatRules,
  ...companyLawRules,
]

export const OPEN_ITEMS: readonly OpenItem[] = [
  ...profitTaxOpenItems,
  ...ownerPayOpenItems,
  ...accountingOpenItems,
  ...vatOpenItems,
  ...companyLawOpenItems,
]

export interface RuleLookup<Value> {
  readonly value: Value
  readonly version: RuleVersion<Value>
  readonly citation: RuleCitation
}

export interface RuleInForce {
  readonly rule: GeneralRule
  /** The versions in force on at least one day of the year, in date order. */
  readonly versions: readonly RuleVersion<RuleTerms>[]
}

export type WatchItem =
  | { readonly kind: 'version'; readonly rule: GeneralRule; readonly version: RuleVersion<RuleTerms> }
  | { readonly kind: 'open'; readonly item: OpenItem }

/**
 * The value of a rule on a date. The caller passes the date the rule's `appliesBy` names: the tax
 * period's first day for the corporate tax, the payment date for a monthly payroll, 31 December
 * for an annual settlement.
 */
export function ruleValue<Id extends RuleId>(id: Id, on: CivilDate): RuleLookup<RuleValues[Id]> {
  const rule = ruleOf(id)
  const version = versionOn(rule, on) as RuleVersion<RuleValues[Id]>
  return { value: version.value, version, citation: citationOf(rule, version) }
}

/** Whether the rule has a version in force on the day, so `ruleValue` gives its value then. */
export function hasVersionOn(id: RuleId, on: CivilDate): boolean {
  return versionInForce(ruleOf(id), on) !== undefined
}

export function versionOn<Value>(rule: Rule<string, Value>, on: CivilDate): RuleVersion<Value> {
  const version = versionInForce(rule, on)
  if (version === undefined) {
    throw new RangeError(`${rule.id} has no version in force on ${on}.`)
  }
  return version
}

function ruleOf(id: RuleId): GeneralRule {
  const rules: readonly GeneralRule[] = RULES
  const rule = rules.find((candidate) => candidate.id === id)
  if (rule === undefined) {
    throw new RangeError(`The ruleset has no rule ${id}.`)
  }
  return rule
}

function versionInForce<Value>(rule: Rule<string, Value>, on: CivilDate): RuleVersion<Value> | undefined {
  return rule.versions.find((candidate) => candidate.validFrom <= on && (candidate.validTo === null || on <= candidate.validTo))
}

export function citationOf<Value>(rule: Rule<string, Value>, version: RuleVersion<Value>): RuleCitation {
  return {
    ruleId: rule.id,
    validFrom: version.validFrom,
    validTo: version.validTo,
    sources: version.sources,
    confidence: version.confidence,
  }
}

/** Every rule in force on some day of the year, with the versions that cover it. A year the ruleset does not reach is refused. */
export function rulesFor(year: number, rules: readonly GeneralRule[] = RULES): readonly RuleInForce[] {
  if (!Number.isInteger(year)) {
    throw new RangeError(`${year} is not a year.`)
  }
  const firstDay = civilDate(year, 1, 1)
  const lastDay = civilDate(year, 12, 31)
  const inForce = rules
    .map((rule) => ({
      rule,
      versions: rule.versions.filter(
        (version) => version.validFrom <= lastDay && (version.validTo === null || version.validTo >= firstDay),
      ),
    }))
    .filter((ruleInYear) => ruleInYear.versions.length > 0)
  if (inForce.length === 0) {
    throw new RangeError(`The ruleset has no rule in force in ${year}.`)
  }
  return inForce
}

/** Every estimate, pending or unconfirmed version, then every open item, for the Ruleset tab's watch list. */
export function watchItems(rules: readonly GeneralRule[] = RULES, openItems: readonly OpenItem[] = OPEN_ITEMS): readonly WatchItem[] {
  const watchedVersions = rules.flatMap((rule) =>
    rule.versions
      .filter((version) => isWatchedConfidence(version.confidence))
      .map((version): WatchItem => ({ kind: 'version', rule, version })),
  )
  const open = openItems.map((item): WatchItem => ({ kind: 'open', item }))
  return [...watchedVersions, ...open]
}
