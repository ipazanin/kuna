import { answered, answersSince, findRecordsArgs, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addMonths, monthOf } from '../../../../../shared/calendar/monthKey'
import { language } from '../../../../../shared/text/language'
import { fakeSpendingDayHere } from '../../../workbook/infrastructure/fake/fakeSpending'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    renovation: 'Renovation',
    labelTitle: "Label last month's three largest payments",
    labelProposed: 'The card below adds the label Renovation and puts it on every part of those entries. Their categories stay. Nothing changes until you accept it.',
    nothingToLabel: 'There were no payments last month to label.',
    trip: (spent: string) => `The Boston trip counted ${spent} of spending.`,
    noTrip: 'No label of yours is called Boston trip.',
  },
  hr: {
    renovation: 'Obnova',
    labelTitle: 'Označi tri najveća plaćanja prošlog mjeseca',
    labelProposed: 'Kartica ispod dodaje oznaku Obnova i stavlja je na sve dijelove tih unosa. Kategorije im ostaju. Ništa se ne mijenja dok je ne prihvatite.',
    nothingToLabel: 'Prošlog mjeseca nije bilo plaćanja za označiti.',
    trip: (spent: string) => `Put u Boston brojao je ${spent} potrošnje.`,
    noTrip: 'Nijedna vaša oznaka ne zove se Put u Boston.',
  },
}

const says = ANSWERS[language]

/** Reads the labels and last month's three largest payments, and proposes a Renovation label on them, added on the same card while the file has none of that name. */
export function labelReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('spending', 'label', { limit: 50 }), tokens)
  if (answers.length === 1) {
    const month = addMonths(monthOf(fakeSpendingDayHere()), -1)
    const spends = findRecordsArgs('spending', 'transaction', {
      from: month,
      to: month,
      filters: [{ field: 'amount', op: 'at-most', values: ['0'] }],
      sort: [{ field: 'amount', direction: 'ascending' }],
      fields: ['payee', 'amount'],
      limit: 3,
    })
    return lookup(1, 'find_records', spends, tokens)
  }
  if (answers.length === 2) {
    const held = recordsIn(answers[0]!.text).find((label) => label.name === says.renovation)?.ref
    const entries = recordsIn(answers[1]!.text).map((row) => ({ entry: row.ref, part: null }))
    if (entries.length === 0) return answered(request, says.nothingToLabel, tokens)
    const steps = [
      ...(held === undefined ? [proposedStep(SPENDING_OPERATIONS, 'add-label', { name: says.renovation }, '$renovation')] : []),
      proposedStep(SPENDING_OPERATIONS, 'label-entries', { label: held ?? '$renovation', entries }),
    ]
    return lookup(2, 'propose_changes', { app: 'spending', title: says.labelTitle, steps, next: false }, tokens)
  }
  return answered(request, says.labelProposed, tokens)
}

/** Reads what each label counts and says what the Boston trip cost, by the figure's ref. */
export function labelCostReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_figures', { app: 'spending', report: 'labels', period: null }, tokens)
  const { figures } = JSON.parse(answers[0]!.text) as { readonly figures: readonly { readonly label: string; readonly ref: string }[] }
  const spent = figures.find((figure) => /^(Boston trip|Put u Boston): spent$/.test(figure.label))
  return answered(request, spent === undefined ? says.noTrip : says.trip(`[${spent.ref}]`), tokens)
}
