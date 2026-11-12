import { answered, answersSince, findRecordsArgs, lookup, proposedStep, registerFakeChat, settingUp } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'
import { LOANS_OPERATIONS } from '../../operations/loansOperations'

const ANSWERS = {
  en: {
    offerTitle: 'Add the offer from Example Bank',
    offerProposed: 'The card below adds the offer as printed. Kuna checks its EKS against the one the bank printed.',
    extraTitle: 'An extra payment on the loan',
    extraProposed: 'The card below adds the extra payment for a shorter term. Nothing changes until you accept it.',
    noLoan: 'There is no bank loan in Loans to pay extra on.',
    loanTitle: 'Add the car loan from the contract',
    loanProposed: "The card below adds the loan as the contract prints it. Kuna's first instalment is not the one the contract prints, so check the terms before you accept.",
  },
  hr: {
    offerTitle: 'Dodaj ponudu banke Example Bank',
    offerProposed: 'Kartica ispod dodaje ponudu kako je ispisana. Kuna provjerava njezin EKS prema onome koji je banka navela.',
    extraTitle: 'Prijevremena otplata kredita',
    extraProposed: 'Kartica ispod dodaje prijevremenu otplatu za kraći rok. Ništa se ne mijenja dok je ne prihvatite.',
    noLoan: 'U Kreditima nema kredita na koji biste platili više.',
    loanTitle: 'Dodaj kredit za automobil iz ugovora',
    loanProposed: 'Kartica ispod dodaje kredit kako ga ugovor ispisuje. Prva rata prema Kuni nije ona iz ugovora, pa provjerite uvjete prije prihvaćanja.',
  },
}

type Says = (typeof ANSWERS)['en']

/** The made-up offer of the document fixtures, as a model would transcribe it, fixed for five years and variable after, whose printed EKS Kuna's estimate does not match. */
function offerStep(): ReturnType<typeof proposedStep> {
  return proposedStep(LOANS_OPERATIONS, 'add-offer', {
    name: '',
    lender: 'Example Bank d.d.',
    principal: 150000,
    rate: '3.18',
    instalments: 360,
    repayment: 'annuity',
    payout: today(),
    fixedYears: 5,
    thenVariable: '3.9',
    subsidyPayer: '',
    upfrontCost: 1000,
    monthlyCost: 0,
    yearlyCost: 0,
    bankEks: '2.28',
    bankInstalment: 647.06,
    changes: [],
  })
}

/** A made-up car loan as a model would transcribe its contract, whose printed first instalment is not the 279.65 Kuna works out. */
function loanStep(): ReturnType<typeof proposedStep> {
  return proposedStep(LOANS_OPERATIONS, 'add-bank-loan', {
    name: 'Car loan',
    lender: 'Example Bank d.d.',
    principal: 15000,
    drawdown: today(),
    firstInstalment: addDays(today(), 30),
    instalments: 60,
    repayment: 'annuity',
    rate: '4.5',
    rateType: 'fixed',
    rateNote: '',
    subsidyPayer: '',
    note: '',
    bankInstalment: 281.2,
  })
}

/** Proposes the offer at once, as a model would from an attached offer, so the card shows Kuna's EKS against the printed one. */
function offerReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    return lookup(0, 'propose_changes', { app: 'loans', title: says.offerTitle, steps: [offerStep()], next: settingUp(request) }, tokens)
  }
  return answered(request, says.offerProposed, tokens)
}

/** Proposes the car loan at once, as a model would from an attached contract, so the card shows Kuna's first instalment against the printed one. */
function loanReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    return lookup(0, 'propose_changes', { app: 'loans', title: says.loanTitle, steps: [loanStep()], next: settingUp(request) }, tokens)
  }
  return answered(request, says.loanProposed, tokens)
}

/** Reads the bank loans and proposes an extra payment on the first, a week from today. */
function extraReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findRecordsArgs('loans', 'bank-loan', { limit: 5 }), tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const [loan] = records
    if (loan === undefined) return answered(request, says.noLoan, tokens)
    const step = proposedStep(LOANS_OPERATIONS, 'add-extra-payment', { loan: loan.ref, date: addDays(today(), 7), amount: 1000, effect: 'shorter-term' })
    return lookup(1, 'propose_changes', { app: 'loans', title: says.extraTitle, steps: [step], next: settingUp(request) }, tokens)
  }
  return answered(request, says.extraProposed, tokens)
}

/** Loans' part of the fake chat: one that starts with offer adds a loan offer, one that starts with extra pays extra on a bank loan, and one that starts with contract adds a car loan. */
function loansChat(turn: FakeChatTurn): ModelReply | null {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/^offer|^ponud/i.test(turn.typed)) return offerReply(turn, says)
  if (/^extra|^prijevremen/i.test(turn.typed)) return extraReply(turn, says)
  if (/^contract|^ugovor/i.test(turn.typed)) return loanReply(turn, says)
  return null
}

export function registerFakeLoansChat(): void {
  registerFakeChat(loansChat)
}
