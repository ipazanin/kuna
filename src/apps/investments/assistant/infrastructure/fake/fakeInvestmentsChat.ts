import { answered, answersSince, findRecordsArgs, lookup, proposedStep, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'
import { INVESTMENTS_OPERATIONS } from '../../operations/investmentsOperations'

const ANSWERS = {
  en: {
    worth: (value: string, gain: string) => `Your portfolio is worth ${value}, a total gain of ${gain} on what you put in.`,
    noAccount: 'Investments has no account to record it on yet. Add one on Settings, General first.',
    buyTitle: 'Record the buy',
    buyProposed: 'The card below records the buy at the rate of its day. Nothing changes until you accept it.',
    sellTitle: 'Record the sale',
    sellRefused: 'Kuna refused that sale: the account does not hold that many units on that day. Check the quantity, or add the buy it came from first.',
    copyTitle: 'Import the copied rows',
    copyProposed: 'The card imports the rows as I copied them. The balances the file prints add up with them.',
    copyRefused: 'Kuna refused the rows. Check them against the file.',
    fileTitle: 'Import the new row of the file',
    fileProposed:
      'The card imports one row I copied from the file. The other looks like a deposit Kuna has, so tell me whether it is a second one. The file prints no balances, so check the row against it.',
    lookAlikeTitle: 'Import the deposit you said is another one',
    lookAlikeProposed: 'The card imports row 1 as another deposit, as you said. Kuna skips the row it has already.',
    noFile: 'Attach the file with the paperclip, and I will copy its rows.',
  },
  hr: {
    worth: (value: string, gain: string) => `Vaš portfelj vrijedi ${value}, uz ukupnu dobit od ${gain} na uloženo.`,
    noAccount: 'Ulaganja još nemaju račun na koji bih to zapisao. Najprije ga dodajte u Postavkama, Općenito.',
    buyTitle: 'Zapiši kupnju',
    buyProposed: 'Kartica ispod zapisuje kupnju po tečaju njezina dana. Ništa se ne mijenja dok je ne prihvatite.',
    sellTitle: 'Zapiši prodaju',
    sellRefused: 'Kuna je odbila tu prodaju: račun toga dana nema toliko jedinica. Provjerite količinu ili najprije dodajte kupnju iz koje dolaze.',
    copyTitle: 'Uvezi prepisane retke',
    copyProposed: 'Kartica uvozi retke kako sam ih prepisao. Stanja koja datoteka ispisuje zbrajaju se s njima.',
    copyRefused: 'Kuna je odbila retke. Provjerite ih s datotekom.',
    fileTitle: 'Uvezi novi redak datoteke',
    fileProposed:
      'Kartica uvozi jedan redak koji sam prepisao iz datoteke. Drugi nalikuje uplati koju Kuna ima, pa mi recite je li to druga uplata. Datoteka ne ispisuje stanja, pa redak usporedite s njom.',
    lookAlikeTitle: 'Uvezi uplatu za koju ste rekli da je druga',
    lookAlikeProposed: 'Kartica uvozi redak 1 kao drugu uplatu, kako ste rekli. Kuna preskače redak koji već ima.',
    noFile: 'Priložite datoteku spajalicom i prepisat ću njezine retke.',
  },
}

type Says = (typeof ANSWERS)['en']

const findAccounts = findRecordsArgs('investments', 'investment-account', { limit: 5 })

function firstRef(answer: string): string | null {
  const { records } = JSON.parse(answer) as { readonly records: readonly { readonly ref: string }[] }
  return records[0]?.ref ?? null
}

/** Reads the portfolio's figures as a real model would, and answers with the value and the total gain by their refs. */
function worthReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_figures', { app: 'investments', report: 'portfolio', period: null }, tokens)
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
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('investments', 'instrument', { limit: 5 }), tokens)
  if (answers.length === 2) {
    const [account, instrument] = [firstRef(answers[0]!.text), firstRef(answers[1]!.text)]
    if (account === null || instrument === null) return answered(request, says.noAccount, tokens)
    const step = proposedStep(INVESTMENTS_OPERATIONS, 'add-trade', {
      side,
      account,
      instrument,
      date: addDays(today(), -7),
      quantity: side === 'buy' ? '1' : '1000000',
      price: '100',
      fees: '1',
      note: '',
    })
    return lookup(2, 'propose_changes', { app: 'investments', title: side === 'buy' ? says.buyTitle : says.sellTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, answers[2]!.isError ? says.sellRefused : says.buyProposed, tokens)
}

/** A deposit row as a model copies it into the workbook's columns. */
function deposit(date: string, cash: string) {
  return {
    date,
    type: 'DEPOSIT',
    symbol: '',
    isin: '',
    name: '',
    currency: 'EUR',
    netCash: cash,
    note: '',
  }
}

/**
 * Reads the first account and copies deposit rows onto it with the balances they lead between: one deposit, or with
 * `again` that deposit and a later one, which Kuna has the first of once the first card is accepted.
 */
function copyReply({ request, tokens }: FakeChatTurn, says: Says, again: boolean): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const account = firstRef(answers[0]!.text)
    if (account === null) return answered(request, says.noAccount, tokens)
    const first = deposit(addDays(today(), -9), '500')
    const rows = again ? [first, deposit(addDays(today(), -8), '200')] : [first]
    const balances = [{ currency: 'EUR', opening: '0', closing: again ? '700' : '500' }]
    const step = proposedStep(INVESTMENTS_OPERATIONS, 'import-transcribed', { account, broker: 'Example Broker', lookAlikes: 'ask', lookAlikeAnswers: [], rows, balances })
    return lookup(1, 'propose_changes', { app: 'investments', title: says.copyTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, answers[1]!.isError ? says.copyRefused : says.copyProposed, tokens)
}

/**
 * Reads the CSV attached to the chat and the first account, and copies the file's two deposits onto it. The first is the
 * deposit the typed copy imports, so it looks like a record Kuna has from another file and the card asks about it. Once
 * the person says it is another deposit, the same rows go again with that answer for row 1, without a second read.
 */
function fileCopyReply(turn: FakeChatTurn, says: Says, personAnswered: boolean): ModelReply {
  const { request, tokens } = turn
  const file = attached(turn, 'csv')
  if (file === null) return answered(request, says.noFile, tokens)
  const reads = personAnswered ? 0 : 1
  const answers = answersSince(request)
  if (answers.length === 0 && reads === 1) return lookup(0, 'read_attachment', { attachment: file, pages: null, sheet: null, rows: '1-3' }, tokens)
  if (answers.length === reads) return lookup(reads, 'find_records', findAccounts, tokens)
  if (answers.length === reads + 1) {
    const account = firstRef(answers[reads]!.text)
    if (account === null) return answered(request, says.noAccount, tokens)
    const lookAlikeAnswers = personAnswered ? [{ row: 1, answer: 'another-record' }] : []
    const rows = [deposit(addDays(today(), -9), '500'), deposit(addDays(today(), -6), '300')]
    const step = proposedStep(INVESTMENTS_OPERATIONS, 'import-transcribed', { file, account, broker: 'Example Broker', lookAlikes: 'ask', lookAlikeAnswers, rows, balances: [] })
    const title = personAnswered ? says.lookAlikeTitle : says.fileTitle
    return lookup(reads + 1, 'propose_changes', { app: 'investments', title, steps: [step], next: false }, tokens)
  }
  if (answers.at(-1)!.isError) return answered(request, says.copyRefused, tokens)
  return answered(request, personAnswered ? says.lookAlikeProposed : says.fileProposed, tokens)
}

/** The last file of this kind attached to the chat, by the id its context line gives, or null for none. */
function attached({ request }: FakeChatTurn, kind: 'csv'): string | null {
  const said = request.turns.flatMap((turn) => (turn.role === 'user' ? turn.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])) : []))
  const ids = said.flatMap((text) => [...text.matchAll(new RegExp(`\\b(a\\d+) \\(${kind}\\b`, 'g'))].map((match) => match[1]!))
  return ids.at(-1) ?? null
}

/**
 * Investments' part of the fake chat: one that starts with buy or sell proposes a trade, one that starts with copy imports
 * deposit rows onto the first account, from the attached CSV when it names the file, one that says a row is another record
 * imports the file's rows again with that answer for it, and a question about the portfolio reads its figures.
 */
function investmentsChat(turn: FakeChatTurn): ModelReply | null {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  if (/^buy|^kupi/i.test(turn.typed)) return tradeReply(turn, says, 'buy')
  if (/^sell|^prodaj/i.test(turn.typed)) return tradeReply(turn, says, 'sell')
  if (/^copy|^prepi/i.test(turn.typed) && /file|datotek/i.test(turn.typed)) return fileCopyReply(turn, says, false)
  if (/another record|drugi zapis/i.test(turn.typed)) return fileCopyReply(turn, says, true)
  if (/^copy|^prepi/i.test(turn.typed)) return copyReply(turn, says, /again|ponovno/i.test(turn.typed))
  if (/portfolio|portfelj/i.test(turn.typed)) return worthReply(turn, says)
  return null
}

export function registerFakeInvestmentsChat(): void {
  registerFakeChat(investmentsChat)
}
