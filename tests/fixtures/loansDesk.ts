import { loansAcceptance, loansProposer } from '../../src/apps/loans/assistant/operations/loansOperations'
import { FILE_OPEN } from './browserFile'
import { BANK_LOAN_WRITES, EXTRA_PAYMENT_WRITES, LATE_INSTALMENT_WRITES, RATE_PERIOD_WRITES } from '../../src/apps/loans/bankLoans/application/bankLoanWrites'
import { INFORMAL_LOAN_WRITES, MOVEMENT_WRITES } from '../../src/apps/loans/informalLoans/application/informalLoanWrites'
import { saveScenario } from '../../src/apps/loans/scenarios/application/scenarioWrites'
import { NO_COSTS } from '../../src/apps/loans/scenarios/domain/loanScenario'
import type { LoanScenario } from '../../src/apps/loans/scenarios/domain/loanScenario'
import { LOAN_SCENARIO_RECORDS } from '../../src/apps/loans/workbook/domain/loanKinds'
import type { LoansBooks } from '../../src/apps/loans/workbook/domain/loansBooks'
import { emptyLoansDocument } from '../../src/apps/loans/workbook/infrastructure/loansDocument'
import type { ChatReads } from '../../src/shared/ai/application/chatReads'
import { proposeChanges } from '../../src/shared/ai/application/chatProposals'
import { chatRefs } from '../../src/shared/ai/domain/chatRefs'
import type { CheckedProposal } from '../../src/shared/app/assistantOperations'
import { newPseudonyms } from '../../src/shared/privacy/domain/pseudonyms'
import type { WorkbookStore } from '../../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import { civil, euros } from './ledger'
import { bankLoan, extraPayment, informalLoan, lateInstalment, movement, percent, ratePeriod } from './loans'
import { LOANS, browserHarness } from './writeBack'

const LOAN = bankLoan()
const FIRST_RATE = ratePeriod(LOAN, '2026-02-05', '3.5')
const LATER_RATE = ratePeriod(LOAN, '2026-08-05', '4')
const EXTRA = extraPayment(LOAN, '2026-06-01', 100, 'shorter-term')
const LATE = lateInstalment(LOAN, '2026-03-05', '2026-03-09')
const ANA = informalLoan()
const REPAID = movement(ANA, '2026-04-01', 'repaid', 500)

/** An offer of 100,000.00 over 20 years, paid out on 2026-12-01, at a fixed 3.5% from its first instalment. */
const OFFER: LoanScenario = {
  id: recordIdOf(LOAN_SCENARIO_RECORDS, 'scenario-offer'),
  name: 'Offer A',
  start: {
    kind: 'offer',
    terms: {
      lender: 'Example Bank',
      principal: euros(100000),
      drawdown: civil('2026-12-01'),
      firstInstalment: civil('2027-01-01'),
      instalments: 240,
      interimInterest: null,
      subsidy: null,
      repayment: 'annuity',
      costs: NO_COSTS,
      bankEks: null,
    },
  },
}

/** A try saved on the bank loan: 200.00 paid early for a shorter term. */
const TRY: LoanScenario = { id: recordIdOf(LOAN_SCENARIO_RECORDS, 'scenario-try'), name: 'Pay 200 early', start: { kind: 'loan', loan: LOAN.id } }

/** The record each operation's example names, by the name it gives it. */
export const EXAMPLE_RECORDS: Readonly<Record<string, string>> = {
  'bank-loan': LOAN.id,
  'rate-period-first': FIRST_RATE.id,
  'rate-period-later': LATER_RATE.id,
  'extra-payment': EXTRA.id,
  'late-instalment': LATE.id,
  'informal-loan': ANA.id,
  movement: REPAID.id,
  'loan-scenario': OFFER.id,
  'loan-scenario-try': TRY.id,
}

/** A Loans file where every operation's example has what it needs, with the chat's refs and the cards it was shown. */
export interface LoansDesk {
  readonly store: WorkbookStore<LoansBooks>
  readonly cards: CheckedProposal[]
  ref(kind: string, id: string): string
  propose(steps: readonly { readonly op: string; readonly input: unknown; readonly as?: string }[]): ReturnType<typeof proposeChanges>
  accept(at?: number): ReturnType<ReturnType<typeof loansAcceptance>['accept']>
}

export async function loansDesk(used: Set<string>): Promise<LoansDesk> {
  const { store: harnessed } = await browserHarness(used, emptyLoansDocument('2026-11-07T09:00:00.000Z'), LOANS)
  const store = harnessed as unknown as WorkbookStore<LoansBooks>
  await store.write('The desk', (unit) => {
    unit.of(BANK_LOAN_WRITES).add(LOAN)
    unit.of(RATE_PERIOD_WRITES).add(FIRST_RATE)
    unit.of(RATE_PERIOD_WRITES).add(LATER_RATE)
    unit.of(EXTRA_PAYMENT_WRITES).add(EXTRA)
    unit.of(LATE_INSTALMENT_WRITES).add(LATE)
    unit.of(INFORMAL_LOAN_WRITES).add(ANA)
    unit.of(MOVEMENT_WRITES).add(REPAID)
    saveScenario(unit, store.state.records!, OFFER, [{ kind: 'rate-change', from: civil('2027-01-01'), rate: percent('3.5'), rateType: 'fixed' }], null)
    saveScenario(unit, store.state.records!, TRY, [{ kind: 'extra-payment', date: civil('2026-09-01'), amount: euros(200), effect: 'shorter-term' }], null)
  })
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: async () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['loans', loansProposer(store, FILE_OPEN)]])
  return {
    store,
    cards,
    ref: (kind, id) => reads.refs.recordRef({ app: 'loans', kind, id }),
    propose: (steps) =>
      proposeChanges(
        { app: 'loans', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })), next: false },
        proposers,
        reads,
        [],
        (_app, card) => cards.push(card),
      ),
    accept: (at = cards.length - 1) => loansAcceptance(store, FILE_OPEN).accept(cards[at]!),
  }
}
