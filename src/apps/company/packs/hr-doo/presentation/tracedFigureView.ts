import type { RouteLocationRaw } from 'vue-router'

import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import type { DrillTarget } from '../../../filters/domain/drillTarget'
import { RULES } from '../ruleset/ruleset'
import type { RuleId } from '../ruleset/ruleset'
import { ruleLink } from '../ruleset/presentation/ruleWording'
import { isWatchedConfidence } from '../ruleset/schema'
import type { RuleCitation, WatchedConfidence } from '../ruleset/schema'
import type { TracedFigure } from '../ruleset/tracedFigure'
import type { BuildUpStep, RuleChip } from './yearEnd/LineBuildUp.vue'

/** A step this deep inside another names this many of its own steps, and the rest by count. */
const NESTED = 6

/** The label with its day, if it names one, as "Advance for Sep 2026, due 31 Oct 2026". */
export function figureLabel(figure: Pick<TracedFigure, 'label' | 'on'>): string {
  return figure.on === null ? figure.label : `${figure.label} ${dayLabel(figure.on)}`
}

/** A figure's steps, each with the first of its own steps under it, opening what `linkOf` finds behind each. */
export function stepsOf(figure: TracedFigure | null, linkOf: (figure: TracedFigure) => RouteLocationRaw | null): BuildUpStep[] {
  if (figure === null) {
    return []
  }
  return figure.steps.flatMap((step, index): BuildUpStep[] => {
    const key = `${index}`
    const nested = step.steps.slice(0, NESTED).map((inner, innerIndex): BuildUpStep => ({ key: `${key}-${innerIndex}`, label: figureLabel(inner), cents: inner.amount, to: linkOf(inner), depth: 1 }))
    const more = step.steps.length - NESTED
    return [
      { key, label: figureLabel(step), cents: step.amount, to: linkOf(step), depth: 0 },
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

/** What a figure opens on: its steps, the rows behind them and the rules it rests on. */
export interface FigureDetail {
  readonly title: string
  readonly subtitle: string
  readonly cents: number
  readonly to: RouteLocationRaw | null
  readonly steps: readonly BuildUpStep[]
  readonly rules: readonly RuleChip[]
  /** Rules among them the ruleset marks estimated, pending or unconfirmed for the year. */
  readonly watched: readonly WatchedRules[]
}

/** The rules a figure rests on that carry one watched mark. */
export interface WatchedRules {
  readonly confidence: WatchedConfidence
  readonly rules: readonly RuleChip[]
}

/** What each watched mark says about the values, before the rules are named. */
export const WATCHED_WORDING: Readonly<Record<WatchedConfidence, string>> = {
  estimate: 'Values the ruleset only estimates',
  pending: 'Values set by a bill or a draft that is not law yet',
  unconfirmed: 'Values not yet confirmed against their source',
}

function citationsIn(figure: TracedFigure): RuleCitation[] {
  return [...figure.rules, ...figure.steps.flatMap(citationsIn)]
}

/** Watched citations grouped by their mark, estimates first, each rule once. */
export function watchedGroups(citations: readonly RuleCitation[]): WatchedRules[] {
  const order: readonly WatchedConfidence[] = ['estimate', 'pending', 'unconfirmed']
  return order.flatMap((confidence) => {
    const ids = citations.filter((citation) => citation.confidence === confidence).map((citation) => citation.ruleId as RuleId)
    return ids.length === 0 ? [] : [{ confidence, rules: chipsOf(ids) }]
  })
}

/** The citations of watched rules anywhere in the figures' build-ups. */
export function watchedCitations(figures: readonly TracedFigure[]): RuleCitation[] {
  return figures.flatMap(citationsIn).filter((citation) => isWatchedConfidence(citation.confidence))
}

/** The watched rules anywhere in the figures' build-ups, grouped by their mark. */
export function watchedIn(figures: readonly TracedFigure[]): WatchedRules[] {
  return watchedGroups(watchedCitations(figures))
}

/** A figure ready to open on its build-up. */
export function figureDetail(figure: TracedFigure, subtitle: string, link: (drill: DrillTarget | null) => RouteLocationRaw | null): FigureDetail {
  return {
    title: figureLabel(figure),
    subtitle,
    cents: figure.amount,
    to: link(figure.drill),
    steps: stepsOf(figure, (step) => link(step.drill)),
    rules: ruleChips(figure.rules),
    watched: watchedIn([figure]),
  }
}
