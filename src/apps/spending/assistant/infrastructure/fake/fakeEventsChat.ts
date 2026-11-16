import { answered, answersSince, findRecordsArgs, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { language } from '../../../../../shared/text/language'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    title: 'Put the streaming subscription back on its days',
    proposed: 'The card below puts the streaming subscription back on its days, so it joins Prague again and follows Prague if its days move. Its category stays. Nothing changes until you accept it.',
    none: 'I found no streaming subscription taken out of an event.',
  },
  hr: {
    title: 'Vrati pretplatu na streaming na njezine dane',
    proposed:
      'Kartica ispod vraća pretplatu na streaming na njezine dane, pa se opet pridružuje Pragu i prati ga ako mu se dani pomaknu. Kategorija joj ostaje. Ništa se ne mijenja dok je ne prihvatite.',
    none: 'Nisam našao pretplatu na streaming izvađenu iz događaja.',
  },
}

const says = ANSWERS[language]

/** Reads the parts taken out of every event, finds the streaming subscription among them, and proposes putting it back on its days. */
export function backOnDaysReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    return lookup(
      0,
      'find_records',
      findRecordsArgs('spending', 'transaction', { filters: [{ field: 'payee', op: 'contains', values: ['Streaming'] }], fields: ['payee', 'amount'], limit: 5 }),
      tokens,
    )
  }
  if (answers.length === 1) {
    const entries = recordsIn(answers[0]!.text).map((row) => ({ entry: row.ref, part: null }))
    if (entries.length === 0) return answered(request, says.none, tokens)
    return lookup(1, 'propose_changes', { app: 'spending', title: says.title, steps: [proposedStep(SPENDING_OPERATIONS, 'back-on-days', { entries })], next: false }, tokens)
  }
  return answered(request, says.proposed, tokens)
}
