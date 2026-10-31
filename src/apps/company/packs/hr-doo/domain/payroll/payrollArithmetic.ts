import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dividedRounded, moneyFromCents, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { formatRate } from '../../../../../../shared/money/moneyFormat'
import type { RuleId, RuleLookup, RuleValues } from '../../ruleset/ruleset'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { FigureBasis, TracedFigure } from '../../ruleset/tracedFigure'

/** Where the payroll engines read the law. Production passes `ruleValue`. A test can pass a lookup that adds a synthetic row. */
export type RuleSource = <Id extends RuleId>(id: Id, on: CivilDate) => RuleLookup<RuleValues[Id]>

const BASIS_POINTS_PER_WHOLE = 10_000

/** An amount times a rate, rounded to the cent half away from zero, as the accountant rounds each payroll line. */
export function atRate(amount: Money, rate: Rate): Money {
  return moneyFromCents(dividedRounded(amount * rate, BASIS_POINTS_PER_WHOLE))
}

/** An amount times `part / whole`, such as a monthly gross for the working days worked, rounded to the cent. */
export function prorated(amount: Money, part: number, whole: number): Money {
  if (!Number.isInteger(part) || !Number.isInteger(whole) || whole <= 0 || part < 0 || part > whole) {
    throw new RangeError(`${part} of ${whole} is not a share of a month.`)
  }
  return moneyFromCents(dividedRounded(amount * part, whole))
}

/** A rate as people write it: 2150 basis points is 21.5%, or 21,5 % in Croatian. */
export function percentText(rate: Rate): string {
  return formatRate(rate / BASIS_POINTS_PER_WHOLE)
}

export function tracedFigure(label: string, amount: Money, basis: FigureBasis, rules: readonly RuleCitation[], steps: readonly TracedFigure[] = []): TracedFigure {
  return { label, on: null, amount, drill: null, basis, rules, steps }
}

/** The rules of a build-up's steps, each rule version once, for a total that only adds them up. */
export function rulesOf(steps: readonly TracedFigure[]): readonly RuleCitation[] {
  const seen = new Set<string>()
  return steps
    .flatMap((step) => step.rules)
    .filter((citation) => {
      const key = `${citation.ruleId} ${citation.validFrom}`
      const fresh = !seen.has(key)
      seen.add(key)
      return fresh
    })
}

/** A total that only adds up its steps, citing their rules. */
export function summed(label: string, steps: readonly TracedFigure[], basis: FigureBasis): TracedFigure {
  return tracedFigure(label, sumMoney(steps.map((step) => step.amount)), basis, rulesOf(steps), steps)
}

/** The same figure as a step that is taken away, so a build-up's steps add up to its total. */
export function deducted(step: TracedFigure): TracedFigure {
  return { ...step, amount: moneyFromCents(0 - step.amount) }
}
