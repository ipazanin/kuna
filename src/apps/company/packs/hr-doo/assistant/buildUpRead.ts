import type { FigureTrace } from '../../../../../shared/ai/domain/chatElement'
import type { TraceRules } from '../../../../../shared/app/assistantReader'
import { citedVersion, sourcesCheckedSince } from '../ruleset/ruleset'
import type { RuleTerms, Term } from '../ruleset/schema'
import { NAMES_A_PARTY } from '../ruleset/tracedFigure'
import type { TracedFigure } from '../ruleset/tracedFigure'

/** The kind a ref to one of the pack's tax rules is handed out under, which the Tax rules tab opens by its id. */
export const TAX_RULE_KIND = 'hr-doo.tax-rule'

/** A table term longer than this goes as its size alone, since the local income tax rates run to some 760,000 characters. */
const MOST_TABLE_ROWS = 40
/** A figure's build-up goes down only as far as this many steps, about 15,000 tokens. A forecast's cash runs to thousands of steps. */
const MOST_STEPS_SENT = 300

/** A step for one ledger row or owner advance, found again by its exact amount. Its label names the other side of the payment. */
function isOneRow(figure: TracedFigure): boolean {
  const amount = figure.drill?.filters.amount
  return amount !== undefined && amount.min === amount.max
}

function withoutRows(figure: TracedFigure): FigureTrace {
  const kept = figure.steps.filter((step) => !isOneRow(step) && step[NAMES_A_PARTY] !== true)
  const cited = new Map(figure.rules.map((citation) => [`${citation.ruleId} ${citation.validFrom}`, { id: citation.ruleId, validFrom: citation.validFrom }]))
  return {
    label: figure.label,
    on: figure.on,
    amount: figure.amount,
    basis: figure.basis,
    rules: [...cited.values()],
    steps: kept.map(withoutRows),
    stepsLeftOut: figure.steps.length - kept.length,
  }
}

/** How many levels below the figure fit in the most steps sent, counting only whole levels. */
function levelsThatFit(figure: FigureTrace): number {
  let level = figure.steps
  let sent = 1
  let levels = 0
  while (level.length > 0 && sent + level.length <= MOST_STEPS_SENT) {
    sent += level.length
    levels += 1
    level = level.flatMap((step) => step.steps)
  }
  return levels
}

function cutBelow(figure: FigureTrace, levels: number): FigureTrace {
  if (levels === 0) {
    return { ...figure, steps: [], stepsLeftOut: figure.stepsLeftOut + figure.steps.length }
  }
  return { ...figure, steps: figure.steps.map((step) => cutBelow(step, levels - 1)) }
}

/**
 * A figure's build-up as the chat may hold it: no step for one ledger row or advance and none that names a client or an
 * item, each only counted on the step above, and as many whole levels as fit in 300 steps, the rest counted the same way.
 */
export function figureTraceOf(figure: TracedFigure): FigureTrace {
  const noRows = withoutRows(figure)
  return cutBelow(noRows, levelsThatFit(noRows))
}

/** The trace and every step under it, the figure first. */
function eachStep(trace: FigureTrace): FigureTrace[] {
  return [trace, ...trace.steps.flatMap(eachStep)]
}

/** The rule versions a trace cites, each once, in the order the tree first cites them. */
function citationsOf(trace: FigureTrace): FigureTrace['rules'] {
  const cited = eachStep(trace).flatMap((step) => step.rules)
  return [...new Map(cited.map((citation) => [`${citation.id} ${citation.validFrom}`, citation])).values()]
}

function termsSent(terms: RuleTerms): Readonly<Record<string, Term | object>> {
  return Object.fromEntries(
    Object.entries(terms).map(([name, term]) => [name, term.kind === 'table' && term.rows.length > MOST_TABLE_ROWS ? { kind: 'table', rows: term.rows.length, leftOut: true } : term]),
  )
}

/** The rule versions a trace cites, with their terms, sources and confidence. */
function versionsOf(trace: FigureTrace): readonly object[] {
  return citationsOf(trace).map((citation) => {
    const version = citedVersion(citation.id, citation.validFrom)
    return {
      id: citation.id,
      validFrom: citation.validFrom,
      validTo: version?.validTo ?? null,
      confidence: version?.confidence ?? null,
      sources: version?.sources ?? [],
      terms: version === null ? null : termsSent(version.value),
    }
  })
}

/** The Croatian d.o.o. ruleset behind the pack's build-ups. */
export const HR_DOO_TRACE_RULES: TraceRules = {
  versionsOf,
  checkedSince: sourcesCheckedSince(),
  ruleKind: TAX_RULE_KIND,
}
