import { answered, answersSince, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'

const ANSWERS = {
  en: {
    notRead: "You didn't allow reading Loans, so I can only tell you how it works.",
    offerTitle: 'Add the offer from Example Bank',
    offerProposed: 'The card below adds the offer as printed. Kuna checks its EKS against the one the bank printed.',
    extraTitle: 'An extra payment on the loan',
    extraProposed: 'The card below adds the extra payment for a shorter term. Nothing changes until you accept it.',
    noLoan: 'There is no bank loan in Loans to pay extra on.',
  },
  hr: {
    notRead: 'Niste dopustili čitanje Kredita, pa vam mogu reći samo kako rade.',
    offerTitle: 'Dodaj ponudu banke Example Bank',
    offerProposed: 'Kartica ispod dodaje ponudu kako je ispisana. Kuna provjerava njezin EKS prema onome koji je banka navela.',
    extraTitle: 'Prijevremena otplata kredita',
    extraProposed: 'Kartica ispod dodaje prijevremenu otplatu za kraći rok. Ništa se ne mijenja dok je ne prihvatite.',
    noLoan: 'U Kreditima nema kredita na koji biste platili više.',
  },
}

type Says = (typeof ANSWERS)['en']

/** The made-up offer of the document fixtures, as a model would transcribe it, fixed for five years and variable after, whose printed EKS Kuna's estimate does not match. */
function offerInput(): Readonly<Record<string, unknown>> {
  return {
    name: '',
    lender: 'Example Bank d.d.',
    principal: 150000,
    rate: '3.18',
    instalments: 360,
    repayment: 'annuity',
    payout: today(),
    firstInstalment: null,
    interimAmount: null,
    interimDate: null,
    fixedYears: 5,
    thenVariable: '3.9',
    subsidyMonthly: null,
    subsidyPayer: '',
    subsidyFirstInstalment: null,
    subsidyInstalments: null,
    upfrontCost: 1000,
    monthlyCost: 0,
    yearlyCost: 0,
    bankEks: '2.28',
    changes: [],
  }
}

/** Proposes the offer at once, as a model would from an attached offer, so the card shows Kuna's EKS against the printed one. */
function offerReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    const step = { op: 'add-offer', input: JSON.stringify(offerInput()), as: null }
    return lookup(0, 'propose_changes', { app: 'loans', title: says.offerTitle, steps: [step] }, tokens)
  }
  return answered(request, answers[0]!.isError ? says.notRead : says.offerProposed, tokens)
}

/** Reads the bank loans and proposes an extra payment on the first, a week from today. */
function extraReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', { app: 'loans', kind: 'bank-loan', query: null, from: null, to: null, about: null, only: null, limit: 5, cursor: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const [loan] = records
    if (loan === undefined) return answered(request, says.noLoan, tokens)
    const step = { op: 'add-extra-payment', input: JSON.stringify({ loan: loan.ref, date: addDays(today(), 7), amount: 1000, effect: 'shorter-term' }), as: null }
    return lookup(1, 'propose_changes', { app: 'loans', title: says.extraTitle, steps: [step] }, tokens)
  }
  return answered(request, answers[1]!.isError ? says.notRead : says.extraProposed, tokens)
}

/** Loans' part of the fake chat: one that starts with offer adds a loan offer, and one that starts with extra pays extra on a bank loan. */
function loansChat(turn: FakeChatTurn): ModelReply | null {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/^offer|^ponud/i.test(turn.typed)) return offerReply(turn, says)
  if (/^extra|^prijevremen/i.test(turn.typed)) return extraReply(turn, says)
  return null
}

export function registerFakeLoansChat(): void {
  registerFakeChat(loansChat)
}
