import { answered, answersSince, findRecordsArgs, goOnsInto, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addMonths, monthOf } from '../../../../../shared/calendar/monthKey'
import { language } from '../../../../../shared/text/language'
import { fakeSpendingDayHere } from '../../../workbook/infrastructure/fake/fakeSpending'
import { copyReply, matchReply, revolutCopyReply, statementReply } from './fakeImportsChat'
import { cardReceiptReply, cashReceiptReply, pickedReceiptReply, receiptReply } from './fakeReceiptsChat'
import { SORT_JOB, closeAccountReply, purseReply, sortGoOnReply, sortJobReply, sortReply } from './fakeSetUpChat'
import { splitReply } from './fakeSplitsChat'

const ANSWERS = {
  en: {
    rules: 'Pick a category on **To review** and choose **Always for this payee**.\n- Each rule then files new rows\n- A row you filed yourself stays as it is',
    spent: (figure: string) => `You spent ${figure} this month.`,
    paid: (who: string, amount: string) => `The latest payment to a person went to ${who}: ${amount}.`,
    invented: 'Last year it was €4,300.00.',
    biggest: 'Your biggest spends last month:',
    noSpends: 'There were no spends last month.',
  },
  hr: {
    rules: 'Odaberite kategoriju na kartici **Za pregled** i zatim **Uvijek za ovog primatelja**.\n- Svako pravilo zatim razvrstava nove retke\n- Redak koji ste sami razvrstali ostaje kakav jest',
    spent: (figure: string) => `Ovaj mjesec potrošili ste ${figure}.`,
    paid: (who: string, amount: string) => `Zadnja uplata osobi otišla je na ${who}: ${amount}.`,
    invented: 'Prošle godine bilo je 4.300,00 €.',
    biggest: 'Vaši najveći troškovi prošlog mjeseca:',
    noSpends: 'Prošlog mjeseca nije bilo troškova.',
  },
}

const says = ANSWERS[language]

/** A person's name came as an alias, or as it is with aliases off: the first payee of the rows that reads as a name. */
function latestPersonPaid(found: string): { readonly payee: string; readonly amount: string } | null {
  const { records } = JSON.parse(found) as { readonly records: readonly { readonly payee?: string; readonly amount: { readonly ref: string } }[] }
  const row = records.find((record) => /^(?:(?:Person|Osoba) \d+|\p{Lu}\p{L}+ \p{Lu}\p{L}+)$/u.test(record.payee ?? ''))
  return row === undefined ? null : { payee: row.payee ?? '', amount: `[${row.amount.ref}]` }
}

/** Reads the month's figures and the latest rows as a real model would, and answers from what the tools gave, with an amount of its own if told to invent one. */
function spendingReply({ request, tokens, invents }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_figures', { app: 'spending', report: 'month', period: null }, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'transaction', { limit: 5 }), tokens)
  const { figures } = JSON.parse(answers[0]!.text) as { readonly figures: readonly { readonly ref: string }[] }
  const paid = latestPersonPaid(answers[1]!.text)
  const parts = [says.spent(`[${figures[0]!.ref}]`), ...(paid === null ? [] : [says.paid(paid.payee, paid.amount)]), ...(invents ? [says.invented] : [])]
  return answered(request, parts.join(' '), tokens)
}

/** Reads last month's spends, the biggest first, and lists the payees with their amounts. */
function biggestReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) {
    const month = addMonths(monthOf(fakeSpendingDayHere()), -1)
    const spends = findRecordsArgs('spending', 'transaction', {
      from: month,
      to: month,
      filters: [{ field: 'amount', op: 'at-most', values: ['0'] }],
      sort: [{ field: 'amount', direction: 'ascending' }],
      fields: ['payee', 'amount'],
      limit: 3,
    })
    return lookup(0, 'find_records', spends, tokens)
  }
  const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly payee?: string; readonly amount: { readonly ref: string } }[] }
  if (records.length === 0) return answered(request, says.noSpends, tokens)
  return answered(request, [says.biggest, ...records.map((record) => `- ${record.payee ?? ''} [${record.amount.ref}]`)].join('\n'), tokens)
}

/** Reads the guide to the first rules and links the tab where rules are kept. */
function rulesReply({ request, tokens, lookups }: FakeChatTurn): ModelReply {
  if (lookups === 0) return lookup(lookups, 'kuna_docs', { path: 'spending/guide/first-rules' }, tokens)
  if (lookups === 1) return lookup(lookups, 'show_screen', { route: '/spending/settings?tab=rules', params: [] }, tokens)
  return answered(request, says.rules, tokens)
}

/**
 * Spending's part of the fake chat: Suggest categories proposes a new category and, at Go on, a rule into it, any other that starts with sort proposes a rule, one that starts with close proposes closing
 * an account with a new IBAN, one that starts with import transcribes a pasted statement, one that starts with transcribe copies a statement a row of which waits as a look-alike, one that asks to bring in the Revolut file reads the attached export as cells and copies its rows, one that asks to check these rows says which rows of that statement Spending has, one about the biggest spends lists last month's, one that asks to read the receipt reads the photo attached and proposes it, on the entry tagged when one is, one that asks to read the cash receipt, says yes to cash or says how much cash there was, proposes it as cash, one that says no, by card proposes it on the first euro account the bank fills, where it waits for the bank's row, one that asks to put the receipt on Harbour bistro proposes it on that payment, one that asks to add a cash purse proposes a second cash account, one that starts with split proposes splitting the latest spend or the Harbour bistro one, a question about spending reads figures and rows, and one about rules reads the guide and links its tab.
 */
function spendingChat(turn: FakeChatTurn): ModelReply | null {
  const { request, typed } = turn
  if (goOnsInto(request, SORT_JOB) !== null) return sortGoOnReply(turn)
  if (SORT_JOB.test(typed)) return sortJobReply(turn)
  if (/^sort|^razvrstaj/i.test(typed)) return sortReply(turn)
  if (/^close|^zatvori/i.test(typed)) return closeAccountReply(turn)
  if (/^import|^uvezi/i.test(typed)) return statementReply(turn)
  if (/^transcribe|^prenesi/i.test(typed)) return copyReply(turn)
  if (/^bring the revolut|^unesi revolut/i.test(typed)) return revolutCopyReply(turn)
  if (/^check these rows|^provjeri ove retke/i.test(typed)) return matchReply(turn)
  if (/biggest spends|najveći troškovi/i.test(typed)) return biggestReply(turn)
  if (/^read the cash receipt|^pročitaj gotovinski račun|^yes, (in )?cash|^da, gotovinom|^i had|^imao sam|^imala sam/i.test(typed)) return cashReceiptReply(turn)
  if (/^put the receipt on|^stavi (fiskalni )?račun na/i.test(typed)) return pickedReceiptReply(turn)
  if (/^no, by card|^ne, karticom/i.test(typed)) return cardReceiptReply(turn)
  if (/^add a cash purse|^dodaj novčanik/i.test(typed)) return purseReply(turn)
  if (/^read (the|this|a)( attached)? receipt|^pročitaj (priloženi )?(fiskalni )?račun/i.test(typed)) return receiptReply(turn)
  if (/^split|^podijeli/i.test(typed)) return splitReply(turn)
  if (/spent|spend|potroš/i.test(typed)) return spendingReply(turn)
  if (/rule|pravil/i.test(typed)) return rulesReply(turn)
  return null
}

export function registerFakeSpendingChat(): void {
  registerFakeChat(spendingChat)
}
