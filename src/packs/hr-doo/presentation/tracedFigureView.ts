import type { RouteLocationRaw } from 'vue-router'

import { RULES } from '../ruleset/ruleset'
import type { RuleId } from '../ruleset/ruleset'
import { ruleLink } from '../ruleset/presentation/ruleWording'
import type { RuleCitation } from '../ruleset/schema'
import type { TracedFigure } from '../ruleset/tracedFigure'
import type { BuildUpStep, RuleChip } from './yearEnd/LineBuildUp.vue'

/** A step this deep inside another names this many of its own steps, and the rest by count. */
const NESTED = 6

/** A figure's steps, each with the first of its own steps under it, opening what `linkOf` finds behind each. */
export function stepsOf(figure: TracedFigure | null, linkOf: (figure: TracedFigure) => RouteLocationRaw | null): BuildUpStep[] {
  if (figure === null) {
    return []
  }
  return figure.steps.flatMap((step, index): BuildUpStep[] => {
    const key = `${index}`
    const nested = step.steps.slice(0, NESTED).map((inner, innerIndex): BuildUpStep => ({ key: `${key}-${innerIndex}`, label: inner.label, cents: inner.amount, to: linkOf(inner), depth: 1 }))
    const more = step.steps.length - NESTED
    return [
      { key, label: step.label, cents: step.amount, to: linkOf(step), depth: 0 },
      ...nested,
      ...(more > 0 ? [{ key: `${key}-more`, label: `and ${more} more`, cents: null, to: linkOf(step), depth: 1 as const }] : []),
    ]
  })
}

export function ruleChips(citations: readonly RuleCitation[]): RuleChip[] {
  return chipsOf(citations.map((citation) => citation.ruleId as RuleId))
}

export function chipsOf(ids: readonly RuleId[]): RuleChip[] {
  return [...new Set(ids)].map((id) => ({ id, title: RULES.find((rule) => rule.id === id)?.title ?? id, to: ruleLink(id) }))
}
