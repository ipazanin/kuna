import { answered, answersSince, findRecordsArgs, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { language } from '../../../../../shared/text/language'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { HOUSEHOLD, recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    splitTitle: 'Split the latest spend',
    splitProposed: 'The card below puts €5.00 of it under Household goods and leaves the rest where it was. Nothing changes until you accept it.',
    nothingToSplit: 'None of the latest rows is a spend I could split.',
    householdPart: 'Cleaning things',
  },
  hr: {
    splitTitle: 'Podijeli zadnji trošak',
    splitProposed: 'Kartica ispod stavlja 5,00 € od njega pod Kućanske potrepštine, a ostatak ostavlja gdje je bio. Ništa se ne mijenja dok je ne prihvatite.',
    nothingToSplit: 'Nijedan od zadnjih redaka nije trošak koji bih mogao podijeliti.',
    householdPart: 'Sredstva za čišćenje',
  },
}

const says = ANSWERS[language]

/**
 * Reads the latest spends of 10 or more, or of Harbour bistro when the message names it, and the categories, and proposes 5 of
 * the first one filed under spending to go under Household goods, the rest where it was.
 */
export function splitReply({ request, tokens, typed }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    const query = /harbour bistro/i.test(typed) ? 'Harbour bistro' : null
    const spends = findRecordsArgs('spending', 'transaction', { query, filters: [{ field: 'amount', op: 'at-most', values: ['-10'] }], fields: ['payee', 'amount', 'category'], limit: 5 })
    return lookup(0, 'find_records', spends, tokens)
  }
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { limit: 50 }), tokens)
  if (answers.length === 2) {
    const categories = recordsIn(answers[1]!.text)
    const household = categories.find((category) => HOUSEHOLD.includes(category.name ?? ''))?.ref
    const spending = new Set(categories.filter((category) => category.kind === 'spending').map((category) => category.ref))
    const row = recordsIn(answers[0]!.text).find((found) => found.category !== undefined && found.category !== household && spending.has(found.category))
    if (row === undefined || household === undefined) return answered(request, says.nothingToSplit, tokens)
    const parts = [
      { amount: 5, category: household, text: says.householdPart },
      { amount: null, category: row.category, text: '' },
    ]
    const step = proposedStep(SPENDING_OPERATIONS, 'split-entry', { entry: row.ref, parts })
    return lookup(2, 'propose_changes', { app: 'spending', title: says.splitTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.splitProposed, tokens)
}
