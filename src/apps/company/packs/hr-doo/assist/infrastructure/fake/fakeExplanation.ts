import { registerFakeAnswer } from '../../../../../../../shared/ai/infrastructure/fake/fakeModel'
import { EXPLAIN_FIGURE } from '../../application/explainFigure'

interface SentFigure {
  readonly ref: string
  readonly label: string
  readonly amount: string
  readonly rules: readonly string[]
  readonly steps: readonly SentFigure[]
}

/**
 * The fake build's explanation of a figure, read from the tree the request sends: one part on the figure, one per step,
 * and a note from the model's own knowledge. `invented-figure` adds an amount Kuna never sent.
 */
export function registerFakeExplanation(): void {
  registerFakeAnswer(EXPLAIN_FIGURE, (request, variant) => {
    const text = request.turns[0]?.role === 'user' ? request.turns[0].parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('\n') : ''
    const figure = JSON.parse(text.split('\n')[1] ?? '{}') as SentFigure
    const rules = [...new Set([figure, ...figure.steps].flatMap((node) => node.rules))]
    const parts = [
      { text: `${figure.label} comes to ${figure.amount}, which Kuna adds up from ${figure.steps.length} steps.`, sources: rules.slice(0, 1), figures: [figure.ref] },
      ...figure.steps.slice(0, 3).map((step) => ({ text: `${step.label} gives ${step.amount}.`, sources: (step.rules.length > 0 ? step.rules : rules).slice(0, 1), figures: [step.ref] })),
      ...(variant === 'invented-figure' ? [{ text: 'Paid a month later it would come to 4,300.00.', sources: rules.slice(0, 1), figures: [] }] : []),
    ]
    return { parts, ownKnowledge: 'Accountants usually check a figure like this against the bank statement of the month it is paid in.' }
  })
}
