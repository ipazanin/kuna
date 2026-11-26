import { answered, answersSince, findRecordsArgs, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { language } from '../../../../../shared/text/language'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    title: "Note Corner market's website",
    proposed: "The card below keeps example.com as Corner market's website and says they are a business. No entry changes until you accept it.",
    none: 'No payee of yours is called Corner market.',
    spellingTitle: 'Take CORNER MARKET D.O.O. off Corner market',
    spellingProposed: 'The card below takes the spelling CORNER MARKET D.O.O. off Corner market and says how many entries stop counting under them. No entry changes until you accept it.',
    noSpelling: 'Corner market has no spelling CORNER MARKET D.O.O.',
  },
  hr: {
    title: 'Zapiši web stranicu za Corner market',
    proposed: 'Kartica ispod zapisuje example.com kao web stranicu za Corner market i kaže da je tvrtka. Nijedan se unos ne mijenja dok je ne prihvatite.',
    none: 'Nijedan vaš primatelj ni platitelj ne zove se Corner market.',
    spellingTitle: 'Ukloni CORNER MARKET D.O.O. s Corner marketa',
    spellingProposed: 'Kartica ispod uklanja naziv CORNER MARKET D.O.O. s Corner marketa i kaže koliko se unosa više ne vodi pod njim. Nijedan se unos ne mijenja dok je ne prihvatite.',
    noSpelling: 'Corner market nema naziv CORNER MARKET D.O.O.',
  },
}

const says = ANSWERS[language]

/** Reads the payees and proposes Corner market's website and business mark through set-payee-details. */
export function payeeDetailsReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('spending', 'payee', { limit: 50 }), tokens)
  if (answers.length === 1) {
    const market = recordsIn(answers[0]!.text).find((payee) => payee.name === 'Corner market')?.ref
    if (market === undefined) return answered(request, says.none, tokens)
    const step = proposedStep(SPENDING_OPERATIONS, 'set-payee-details', { payee: market, party: 'business', website: 'example.com' })
    return lookup(1, 'propose_changes', { app: 'spending', title: says.title, steps: [step], next: false }, tokens)
  }
  return answered(request, says.proposed, tokens)
}

/** The spelling of the market's bank rows, which the fake payees keep as Corner market's other name. */
const BANK_SPELLING = 'CORNER MARKET D.O.O.'

/** Reads the payees and proposes taking the bank's spelling off Corner market through take-spelling-off-payee. */
export function payeeSpellingReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('spending', 'payee', { limit: 50 }), tokens)
  if (answers.length === 1) {
    const market = recordsIn(answers[0]!.text).find((payee) => payee.name === 'Corner market' && payee.otherNames?.includes(BANK_SPELLING) === true)?.ref
    if (market === undefined) return answered(request, says.noSpelling, tokens)
    const step = proposedStep(SPENDING_OPERATIONS, 'take-spelling-off-payee', { payee: market, spelling: BANK_SPELLING })
    return lookup(1, 'propose_changes', { app: 'spending', title: says.spellingTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.spellingProposed, tokens)
}
