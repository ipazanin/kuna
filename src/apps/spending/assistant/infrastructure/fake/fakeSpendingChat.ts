import { answered, answersSince, lookup, registerFakeChat } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays, today } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'

const ANSWERS = {
  en: {
    rules: 'Pick a category on **To review** and choose **Always for this payee**.\n- Each rule then files new rows\n- A row you filed yourself stays as it is',
    spent: (figure: string) => `You spent ${figure} this month.`,
    paid: (who: string, amount: string) => `The latest payment to a person went to ${who}: ${amount}.`,
    notRead: "You didn't allow reading Spending, so I can only tell you how it works.",
    invented: 'Last year it was €4,300.00.',
    proposed: 'The card below sorts them. Nothing changes until you accept it.',
    proposalTitle: 'Rules for what keeps coming',
    closeTitle: 'Close the old account',
    closeProposed: 'The card below closes the account and gives it the new IBAN. Check the IBAN before you accept.',
    nothingToSort: 'None of the latest rows names a shop I could make a rule for.',
    statementTitle: 'Import the pasted statement',
    statementProposed: 'I misread one amount at first, so Kuna refused it as not adding up. The card below now ties from the opening balance to the closing one.',
  },
  hr: {
    rules: 'Odaberite kategoriju na **Za pregled** i zatim **Uvijek za ovog primatelja**.\n- Svako pravilo zatim razvrstava nove retke\n- Redak koji ste sami razvrstali ostaje kakav jest',
    spent: (figure: string) => `Ovaj mjesec potrošili ste ${figure}.`,
    paid: (who: string, amount: string) => `Zadnja uplata osobi otišla je na ${who}: ${amount}.`,
    notRead: 'Niste dopustili čitanje Potrošnje, pa vam mogu reći samo kako radi.',
    invented: 'Prošle godine bilo je 4.300,00 €.',
    proposed: 'Kartica ispod ih razvrstava. Ništa se ne mijenja dok je ne prihvatite.',
    proposalTitle: 'Pravila za ono što se ponavlja',
    closeTitle: 'Zatvori stari račun',
    closeProposed: 'Kartica ispod zatvara račun i daje mu novi IBAN. Provjerite IBAN prije nego što prihvatite.',
    nothingToSort: 'Nijedan od zadnjih redaka ne navodi trgovinu za koju bih mogao napraviti pravilo.',
    statementTitle: 'Uvezi zalijepljeni izvod',
    statementProposed: 'Isprva sam krivo pročitao jedan iznos, pa ga je Kuna odbila jer se ne zbraja. Kartica ispod sada se slaže od početnog do završnog stanja.',
  },
}

type Says = (typeof ANSWERS)['en']

/** A person's name came as an alias, or as it is with aliases off: the first payee of the rows that reads as a name. */
function latestPersonPaid(found: string): { readonly payee: string; readonly amount: string } | null {
  const { records } = JSON.parse(found) as { readonly records: readonly { readonly payee?: string; readonly amount: { readonly ref: string } }[] }
  const row = records.find((record) => /^(?:(?:Person|Osoba) \d+|\p{Lu}\p{L}+ \p{Lu}\p{L}+)$/u.test(record.payee ?? ''))
  return row === undefined ? null : { payee: row.payee ?? '', amount: `[${row.amount.ref}]` }
}

/** Reads the month's figures and the latest rows as a real model would, and answers from what the tools gave, with an amount of its own if told to invent one. */
function spendingReply({ request, tokens, invents }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'read_figures', { app: 'spending', report: 'month', period: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, only: null, limit: 5, cursor: null }, tokens)
  const { figures } = JSON.parse(answers[0]!.text) as { readonly figures: readonly { readonly ref: string }[] }
  const paid = latestPersonPaid(answers[1]!.text)
  const parts = [says.spent(`[${figures[0]!.ref}]`), ...(paid === null ? [] : [says.paid(paid.payee, paid.amount)]), ...(invents ? [says.invented] : [])]
  return answered(request, parts.join(' '), tokens)
}

/** Reads the latest rows and proposes a rule from the first filed row with a shop's name and no IBAN, into the category that row is under, so the rule never files a person's payments. */
function sortReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, only: null, limit: 5, cursor: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as {
      readonly records: readonly { readonly ref: string; readonly payee?: string; readonly category?: string; readonly counterpartyIban?: string }[]
    }
    const row = records.find((record) => record.category !== undefined && record.counterpartyIban === undefined && !/^(?:Person|Osoba) \d+$/.test(record.payee ?? ''))
    if (row === undefined) return answered(request, says.nothingToSort, tokens)
    const step = { op: 'add-rule', input: JSON.stringify({ row: row.ref, fragment: null, category: row.category }), as: null }
    return lookup(1, 'propose_changes', { app: 'spending', title: says.proposalTitle, steps: [step] }, tokens)
  }
  return answered(request, says.proposed, tokens)
}

/** A made-up IBAN that passes the check, as a person might give it for the account's new number. */
const NEW_IBAN = 'HR1210010051863000160'

/** Reads the accounts and proposes closing the first, with a new IBAN on it, so the card shows a closed account and a line it warns on. */
function closeAccountReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', { app: 'spending', kind: 'account', query: null, from: null, to: null, about: null, only: null, limit: 5, cursor: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length === 1) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const step = {
      op: 'change-account',
      input: JSON.stringify({ account: records[0]!.ref, name: null, kind: null, bank: null, currency: null, opening: null, openedOn: null, iban: NEW_IBAN, closed: 'yes' }),
      as: null,
    }
    return lookup(1, 'propose_changes', { app: 'spending', title: says.closeTitle, steps: [step] }, tokens)
  }
  return answered(request, says.closeProposed, tokens)
}

/** Rows as a model would read them off a pasted statement, all made up, dated in the last week so every account is open by then. */
function statementRows(misread: boolean): readonly { readonly date: string; readonly amount: number; readonly payee: string; readonly iban: null }[] {
  const day = today()
  return [
    { date: addDays(day, -6), amount: -12.5, payee: 'Corner market', iban: null },
    { date: addDays(day, -5), amount: misread ? -40.01 : -40, payee: 'Harbour bistro', iban: null },
    { date: addDays(day, -4), amount: 100, payee: 'Mali dućan', iban: null },
  ]
}

/** Reads the accounts and transcribes a pasted statement onto the first: once with one amount a cent off, which Kuna refuses, then as printed. */
function statementReply({ request, tokens }: FakeChatTurn, says: Says): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', { app: 'spending', kind: 'account', query: null, from: null, to: null, about: null, only: null, limit: 5, cursor: null }, tokens)
  if (answers[0]!.isError) return answered(request, says.notRead, tokens)
  if (answers.length < 3) {
    const { records } = JSON.parse(answers[0]!.text) as { readonly records: readonly { readonly ref: string }[] }
    const input = { file: null, account: records[0]!.ref, opening: 500, closing: 547.5, rows: statementRows(answers.length === 1), part: 1 }
    const step = { op: 'import-statement', input: JSON.stringify(input), as: null }
    return lookup(answers.length, 'propose_changes', { app: 'spending', title: says.statementTitle, steps: [step] }, tokens)
  }
  return answered(request, says.statementProposed, tokens)
}

/**
 * Spending's part of the fake chat: one that starts with sort proposes a rule, one that starts with close proposes closing
 * an account with a new IBAN, one that starts with import transcribes a pasted statement, a question about spending reads figures and rows, and one about rules reads the guide and links its tab.
 */
function spendingChat(turn: FakeChatTurn): ModelReply | null {
  const says = ANSWERS[language === 'hr' ? 'hr' : 'en']
  const { request, tokens, typed, lookups } = turn
  if (/^sort|^razvrstaj/i.test(typed)) return sortReply(turn, says)
  if (/^close|^zatvori/i.test(typed)) return closeAccountReply(turn, says)
  if (/^import|^uvezi/i.test(typed)) return statementReply(turn, says)
  if (/spent|spend|potroš/i.test(typed)) return spendingReply(turn, says)
  if (/rule|pravil/i.test(typed)) {
    if (lookups === 0) return lookup(lookups, 'kuna_docs', { path: 'spending/guide/first-rules' }, tokens)
    if (lookups === 1) return lookup(lookups, 'show_screen', { route: '/spending/settings?tab=rules', params: [] }, tokens)
    return answered(request, says.rules, tokens)
  }
  return null
}

export function registerFakeSpendingChat(): void {
  registerFakeChat(spendingChat)
}
