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
    workbookTitle: 'Import the portfolio workbook',
    workbookProposed: 'Kuna read the workbook itself. The card below shows what its import adds, and what waits for an answer in Overview, Import.',
    workbookRefused: 'Kuna could not import that file. Check that it is the portfolio workbook with its Transactions tab.',
    copyTitle: 'Import the copied rows',
    copyProposed: 'The card imports the rows as I copied them. The balances the file prints add up with them.',
    copyRefused: 'Kuna refused the rows. Check them against the file.',
    noWorkbook: 'Attach the portfolio workbook with the paperclip, and I will propose its import.',
    reportTitle: 'Import the IBKR report',
    reportProposed: 'Kuna read the report itself, through the same review as the mailed one. The card below shows what it adds.',
    reportRefused: 'Kuna could not import that file. Check that it is an Activity Flex report in XML.',
  },
  hr: {
    worth: (value: string, gain: string) => `Vaš portfelj vrijedi ${value}, uz ukupnu dobit od ${gain} na uloženo.`,
    notRead: 'Niste dopustili čitanje Ulaganja, pa vam mogu reći samo kako rade.',
    buyTitle: 'Zapiši kupnju',
    buyProposed: 'Kartica ispod zapisuje kupnju po tečaju njezina dana. Ništa se ne mijenja dok je ne prihvatite.',
    sellTitle: 'Zapiši prodaju',
    sellRefused: 'Kuna je odbila tu prodaju: račun toga dana nema toliko jedinica. Provjerite količinu ili najprije dodajte kupnju iz koje dolaze.',
    workbookTitle: 'Uvezi radnu knjigu portfelja',
    workbookProposed: 'Kuna je sama pročitala radnu knjigu. Kartica ispod pokazuje što uvoz dodaje i što čeka odgovor u Uvozu na Pregledu.',
    workbookRefused: 'Kuna nije mogla uvesti tu datoteku. Provjerite je li to radna knjiga portfelja s karticom Transactions.',
    copyTitle: 'Uvezi prepisane retke',
    copyProposed: 'Kartica uvozi retke kako sam ih prepisao. Stanja koja datoteka ispisuje zbrajaju se s njima.',
    copyRefused: 'Kuna je odbila retke. Provjerite ih s datotekom.',
    noWorkbook: 'Priložite radnu knjigu portfelja spajalicom i predložit ću njezin uvoz.',
    reportTitle: 'Uvezi izvješće IBKR-a',
    reportProposed: 'Kuna je sama pročitala izvješće, istim pregledom kao ono poslano poštom. Kartica ispod pokazuje što dodaje.',
    reportRefused: 'Kuna nije mogla uvesti tu datoteku. Provjerite je li to izvješće Activity Flex u formatu XML.',
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

/**
 * Reads the first account and copies deposit rows onto it with the balances they lead between: one deposit, or with
 * `again` that deposit and a later one, which Kuna has the first of once the first card is accepted.
 */
function copyReply({ request, tokens }: FakeChatTurn, says: Says, again: boolean): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', { app: 'investments', kind: 'investment-account', ...FIND }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) {
    const account = firstRef(answers[0]!.text)
    if (account === null) return answered(request, says.notRead, tokens)
    const deposit = (date: string, cash: string) => ({
      date,
      type: 'DEPOSIT',
      symbol: '',
      isin: '',
      name: '',
      quantity: null,
      price: null,
      currency: 'EUR',
      gross: null,
      commission: null,
      commissionCurrency: null,
      netCash: cash,
      counterCurrency: null,
      counterAmount: null,
      note: '',
    })
    const first = deposit(addDays(today(), -9), '500')
    const rows = again ? [first, deposit(addDays(today(), -8), '200')] : [first]
    const balances = [{ currency: 'EUR', opening: '0', closing: again ? '700' : '500' }]
    const input = { file: null, account, broker: 'Example Broker', lookAlikes: 'ask', rows, balances }
    return lookup(1, 'propose_changes', { app: 'investments', title: says.copyTitle, steps: [{ op: 'import-transcribed', input: JSON.stringify(input), as: null }] }, tokens)
  }
  return answered(request, answers[1]!.isError ? says.copyRefused : says.copyProposed, tokens)
}

/** The last file of this kind attached to the chat, by the id its context line gives, or null for none. */
function attached({ request }: FakeChatTurn, kind: 'sheet' | 'xml'): string | null {
  const said = request.turns.flatMap((turn) => (turn.role === 'user' ? turn.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])) : []))
  const ids = said.flatMap((text) => [...text.matchAll(new RegExp(`\\b(a\\d+) \\(${kind}\\b`, 'g'))].map((match) => match[1]!))
  return ids.at(-1) ?? null
}

/** Proposes the import of the spreadsheet attached last, which Kuna reads itself, keeping records gone from it. */
function workbookReply(turn: FakeChatTurn, says: Says): ModelReply {
  const { request, tokens } = turn
  const file = attached(turn, 'sheet')
  if (file === null) return answered(request, says.noWorkbook, tokens)
  const answers = answersSince(request)
  if (answers.length === 0) {
    const step = { op: 'import-workbook', input: JSON.stringify({ file, gone: 'keep' }), as: null }
    return lookup(0, 'propose_changes', { app: 'investments', title: says.workbookTitle, steps: [step] }, tokens)
  }
  return answered(request, answers[0]!.isError ? says.workbookRefused : says.workbookProposed, tokens)
}

/** Proposes the import of the Flex report attached last, which Kuna reads itself, keeping the rows it asks about waiting. */
function reportReply(turn: FakeChatTurn, says: Says, file: string): ModelReply {
  const { request, tokens } = turn
  const answers = answersSince(request)
  if (answers.length === 0) {
    const step = { op: 'import-flex-report', input: JSON.stringify({ file, asked: 'hold' }), as: null }
    return lookup(0, 'propose_changes', { app: 'investments', title: says.reportTitle, steps: [step] }, tokens)
  }
  return answered(request, answers[0]!.isError ? says.reportRefused : says.reportProposed, tokens)
}

/** Investments' part of the fake chat: one that starts with buy or sell proposes a trade, one that starts with copy imports deposit rows onto the first account, one about the workbook imports the sheet attached, one about importing with an XML attached imports that Flex report, and a question about the portfolio reads its figures. */
function investmentsChat(turn: FakeChatTurn): ModelReply | null {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/^buy|^kupi/i.test(turn.typed)) return tradeReply(turn, says, 'buy')
  if (/^sell|^prodaj/i.test(turn.typed)) return tradeReply(turn, says, 'sell')
  if (/^copy|^prepi/i.test(turn.typed)) return copyReply(turn, says, /again|ponovno/i.test(turn.typed))
  if (/workbook|radn\w* knjig/i.test(turn.typed)) return workbookReply(turn, says)
  const report = attached(turn, 'xml')
  if (report !== null && /import|uvez/i.test(turn.typed)) return reportReply(turn, says, report)
  if (/portfolio|portfelj/i.test(turn.typed)) return worthReply(turn, says)
  return null
}

export function registerFakeInvestmentsChat(): void {
  registerFakeChat(investmentsChat)
}
