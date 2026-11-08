import { answered, answersSince, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'

const ANSWERS = {
  en: {
    worth: (value: string, gain: string) => `Your portfolio is worth ${value}, a total gain of ${gain} on what you put in.`,
    notRead: "You didn't allow reading Investments, so I can only tell you how it works.",
    buyTitle: 'Record the buy',
    buyProposed: 'The card below records the buy at the rate of its day. Nothing changes until you accept it.',
    sellTitle: 'Record the sale',
    sellRefused: 'Kuna refused that sale: the account does not hold that many units on that day. Check the quantity, or add the buy it came from first.',
  },
  hr: {
    worth: (value: string, gain: string) => `Vaš portfelj vrijedi ${value}, uz ukupnu dobit od ${gain} na uloženo.`,
    notRead: 'Niste dopustili čitanje Ulaganja, pa vam mogu reći samo kako rade.',
    buyTitle: 'Zapiši kupnju',
    buyProposed: 'Kartica ispod zapisuje kupnju po tečaju njezina dana. Ništa se ne mijenja dok je ne prihvatite.',
    sellTitle: 'Zapiši prodaju',
    sellRefused: 'Kuna je odbila tu prodaju: račun toga dana nema toliko jedinica. Provjerite količinu ili najprije dodajte kupnju iz koje dolaze.',
  },
}

type Says = (typeof ANSWERS)['en']

const FIND = { query: null, from: null, to: null, about: null, only: null, limit: 5, cursor: null }

function firstRef(answer: string): string | null {
  const { records } = JSON.parse(answer) as { readonly records: readonly { readonly ref: string }[] }
  return records[0]?.ref ?? null
}

/** Reads the portfolio's figures as a real model would, and answers with the value and the total gain by their refs. */
function worthReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_figures', { app: 'investments', report: 'portfolio', period: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  const { figures } = JSON.parse(answers[0]!.text) as { readonly figures: readonly { readonly ref: string; readonly label: string }[] }
  const refOf = (label: string): string => `[${figures.find((figure) => figure.label === label)?.ref ?? ''}]`
  return answered(request, says.worth(refOf('value'), refOf('total gain')), tokens)
}

/**
 * Reads the accounts and the instruments, and proposes a trade of the first instrument in the first account: a buy of one
 * unit last week at the ECB rate of its day, or a sale of a million units, which the trade dialog's check refuses.
 */
function tradeReply({ request, tokens }: FakeChatTurn, says: Says, side: 'buy' | 'sell'): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', { app: 'investments', kind: 'investment-account', ...FIND }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', { app: 'investments', kind: 'instrument', ...FIND }, tokens)
  if (answers.length === 2) {
    const [account, instrument] = [firstRef(answers[0]!.text), firstRef(answers[1]!.text)]
    if (account === null || instrument === null) return answered(request, says.notRead, tokens)
    const input = { side, account, instrument, date: addDays(today(), -7), quantity: side === 'buy' ? '1' : '1000000', price: '100', fees: '1', rate: null, note: '' }
    const step = { op: 'add-trade', input: JSON.stringify(input), as: null }
    return lookup(2, 'propose_changes', { app: 'investments', title: side === 'buy' ? says.buyTitle : says.sellTitle, steps: [step] }, tokens)
  }
  return answered(request, answers[2]!.isError ? says.sellRefused : says.buyProposed, tokens)
}

/** Investments' part of the fake chat: one that starts with buy or sell proposes a trade, and a question about the portfolio reads its figures. */
function investmentsChat(turn: FakeChatTurn): ModelReply | null {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/^buy|^kupi/i.test(turn.typed)) return tradeReply(turn, says, 'buy')
  if (/^sell|^prodaj/i.test(turn.typed)) return tradeReply(turn, says, 'sell')
  if (/portfolio|portfelj/i.test(turn.typed)) return worthReply(turn, says)
  return null
}

export function registerFakeInvestmentsChat(): void {
  registerFakeChat(investmentsChat)
}
