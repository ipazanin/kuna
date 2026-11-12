import { answered, answersSince, findRecordsArgs, lookup, proposedStep, registerFakeChat } from '../../../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../../../shared/ai/application/modelPort'
import { language } from '../../../../../../../shared/text/language'
import { inCompany } from '../../../../../assistant/infrastructure/fake/fakeCompanyChat'
import { TRIP_OPERATIONS } from '../../operations/tripOperations'

const ANSWERS = {
  en: {
    tripCostTitle: 'Add the parking to travel order 3/2026',
    parking: 'Parking garage in Rijeka',
    tripCost: 'The card adds 18.00 of parking the traveller paid to travel order 3/2026. It is paid back in the settlement once the trip is settled.',
    noTrip: 'I found no travel order 3/2026 in the books.',
  },
  hr: {
    tripCostTitle: 'Dodaj parkiranje putnom nalogu 3/2026',
    parking: 'Garaža u Rijeci',
    tripCost: 'Kartica putnom nalogu 3/2026 dodaje 18,00 eura parkiranja koje je platio putnik. Putniku se vraća u obračunu kad se put obračuna.',
    noTrip: 'U knjigama nisam našao putni nalog 3/2026.',
  },
}

const says = ANSWERS[language]

/** Reads the travel orders and proposes a parking cost the traveller paid on order 3/2026. */
function tripCostReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('company', 'hr-doo.trip', { limit: 10 }), tokens)
  if (answers.length === 1) {
    const trip = (JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string; readonly number?: string }[] }).records.find((record) => record.number === '3/2026')
    if (trip === undefined) return answered(request, says.noTrip, tokens)
    const step = proposedStep(TRIP_OPERATIONS, 'add-trip-cost', { trip: trip.ref, date: '2026-10-01', kind: 'parking', description: says.parking, amount: '18', paidBy: 'traveller' })
    return lookup(1, 'propose_changes', { app: 'company', title: says.tripCostTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.tripCost, tokens)
}

/** The hr-doo pack's part of the fake chat, only while the person is on a Company screen: one about parking adds a cost to travel order 3/2026. */
function tripChat(turn: FakeChatTurn): ModelReply | null {
  return inCompany(turn.request) && /parking|parkiranj/i.test(turn.typed) ? tripCostReply(turn) : null
}

export function registerFakeTripChat(): void {
  registerFakeChat(tripChat)
}
