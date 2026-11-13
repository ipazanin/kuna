import { answered, answersSince, findRecordsArgs, lookup, proposedStep } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { FakeChatTurn } from '../../../../../shared/ai/infrastructure/fake/fakeChatReply'
import type { ModelReply } from '../../../../../shared/ai/application/modelPort'
import { addDays } from '../../../../../shared/calendar/civilDate'
import { language } from '../../../../../shared/text/language'
import { SPENDING_OPERATIONS } from '../../operations/spendingOperations'
import { fakeSpendingDayHere } from '../../../workbook/infrastructure/fake/fakeSpending'
import { findAccounts, recordsIn } from './fakeSpendingRecords'

const ANSWERS = {
  en: {
    proposed: 'The card below sorts them. Nothing changes until you accept it.',
    proposalTitle: 'Rules for what keeps coming',
    nothingToSort: 'None of the latest rows names a shop I could make a rule for.',
    pharmacy: 'Pharmacy',
    pharmacyTitle: 'A category for the pharmacy',
    pharmacyProposed: 'The card adds Pharmacy for the pharmacy rows waiting. Once you accept, the next card files them there with a rule.',
    pharmacyRuleTitle: 'File the pharmacy with a rule',
    pharmacyRuled: 'The card adds a rule for the pharmacy and files its waiting rows under Pharmacy.',
    closeTitle: 'Close the old account',
    closeProposed: 'The card below closes the account and gives it the new IBAN. Check the IBAN before you accept.',
    purseTitle: 'A second cash account',
    purse: 'Purse',
    purseProposed: 'The card below adds a cash account in euros called Purse.',
  },
  hr: {
    proposed: 'Kartica ispod ih razvrstava. Ništa se ne mijenja dok je ne prihvatite.',
    proposalTitle: 'Pravila za ono što se ponavlja',
    nothingToSort: 'Nijedan od zadnjih redaka ne navodi trgovinu za koju bih mogao napraviti pravilo.',
    pharmacy: 'Ljekarna',
    pharmacyTitle: 'Kategorija za ljekarnu',
    pharmacyProposed: 'Kartica dodaje Ljekarnu za retke ljekarne koji čekaju. Kad prihvatite, sljedeća kartica razvrstava ih u nju s pravilom.',
    pharmacyRuleTitle: 'Razvrstaj ljekarnu s pravilom',
    pharmacyRuled: 'Kartica dodaje pravilo za ljekarnu i razvrstava njezine retke koji čekaju u Ljekarnu.',
    closeTitle: 'Zatvori stari račun',
    closeProposed: 'Kartica ispod zatvara račun i daje mu novi IBAN. Provjerite IBAN prije nego što prihvatite.',
    purseTitle: 'Drugi račun gotovine',
    purse: 'Novčanik',
    purseProposed: 'Kartica ispod dodaje račun gotovine u eurima pod nazivom Novčanik.',
  },
}

const says = ANSWERS[language]

/** What asks to sort the rows waiting, as Suggest categories on To review and the quick action do. */
export const SORT_JOB = /^sort the rows waiting on to review\. |^razvrstaj retke koji čekaju na kartici za pregled\. /i

/**
 * Reads the latest rows and their parts, and proposes a rule from the first filed row with a shop's name and no IBAN, into the
 * category its part is under, so the rule never files a person's payments. `before` counts the lookups the turn made before it.
 */
export function sortReply({ request, tokens }: FakeChatTurn, before = 0): ModelReply {
  const answers = answersSince(request).slice(before)
  if (answers.length === 0) return lookup(before, 'find_records', findRecordsArgs('spending', 'transaction', { limit: 5 }), tokens)
  if (answers.length === 1) {
    const rows = recordsIn(answers[0]!.text).map((record) => record.ref)
    return lookup(before + 1, 'find_records', findRecordsArgs('spending', 'item', { refs: rows, fields: ['transaction', 'category'], limit: 20 }), tokens)
  }
  if (answers.length === 2) {
    const items = recordsIn(answers[1]!.text)
    const categoryOf = (row: string): string | undefined => items.find((item) => item.transaction === row && item.category !== undefined)?.category
    const row = recordsIn(answers[0]!.text).find((record) => categoryOf(record.ref) !== undefined && record.counterpartyIban === undefined && !/^(?:Person|Osoba) \d+$/.test(record.payee ?? ''))
    if (row === undefined) return answered(request, says.nothingToSort, tokens)
    const step = proposedStep(SPENDING_OPERATIONS, 'add-rule', { row: row.ref, category: categoryOf(row.ref) })
    return lookup(before + 2, 'propose_changes', { app: 'spending', title: says.proposalTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.proposed, tokens)
}

const findWaiting = findRecordsArgs('spending', 'transaction', { only: 'waiting' })

/**
 * Reads the rows waiting and proposes a new category for the first one with a payee, as no category fits it, with a card
 * after it. With nothing waiting it proposes a rule from the latest rows instead.
 */
export function sortJobReply(turn: FakeChatTurn): ModelReply {
  const { request, tokens } = turn
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findWaiting, tokens)
  if (recordsIn(answers[0]!.text).every((row) => row.payee === undefined)) return sortReply(turn, 1)
  if (answers.length === 1) {
    const step = proposedStep(SPENDING_OPERATIONS, 'add-category', { name: says.pharmacy, kind: 'spending' })
    return lookup(1, 'propose_changes', { app: 'spending', title: says.pharmacyTitle, steps: [step], next: true }, tokens)
  }
  return answered(request, says.pharmacyProposed, tokens)
}

/** The card Go on asks for in the sorting job: a rule from the first waiting row with a payee into the new category. */
export function sortGoOnReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findWaiting, tokens)
  if (answers.length === 1) return lookup(1, 'find_records', findRecordsArgs('spending', 'category', { query: says.pharmacy, limit: 5 }), tokens)
  if (answers.length === 2) {
    const row = recordsIn(answers[0]!.text).find((waiting) => waiting.payee !== undefined)
    const category = recordsIn(answers[1]!.text).find((found) => found.name === says.pharmacy)?.ref
    if (row === undefined || category === undefined) return answered(request, says.nothingToSort, tokens)
    const step = proposedStep(SPENDING_OPERATIONS, 'add-rule', { row: row.ref, category })
    return lookup(2, 'propose_changes', { app: 'spending', title: says.pharmacyRuleTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.pharmacyRuled, tokens)
}

/** A made-up IBAN that passes the check, as a person might give it for the account's new number. */
const NEW_IBAN = 'HR1210010051863000160'

/** Reads the accounts and proposes closing the first, with a new IBAN on it, so the card shows a closed account and a line it warns on. */
export function closeAccountReply({ request, tokens }: FakeChatTurn): ModelReply {
  const answers = answersSince(request)
  if (answers.length === 0) return lookup(0, 'find_records', findAccounts, tokens)
  if (answers.length === 1) {
    const step = proposedStep(SPENDING_OPERATIONS, 'change-account', { account: recordsIn(answers[0]!.text)[0]!.ref, iban: NEW_IBAN, closed: 'yes' })
    return lookup(1, 'propose_changes', { app: 'spending', title: says.closeTitle, steps: [step], next: false }, tokens)
  }
  return answered(request, says.closeProposed, tokens)
}

/** Proposes a second cash account in euros, so a cash receipt has two to go on. */
export function purseReply({ request, tokens, lookups }: FakeChatTurn): ModelReply {
  if (lookups > 0) return answered(request, says.purseProposed, tokens)
  const step = proposedStep(SPENDING_OPERATIONS, 'add-account', { name: says.purse, kind: 'cash', currency: 'EUR', opening: 0, openedOn: addDays(fakeSpendingDayHere(), -30), rowsFrom: 'by-hand' })
  return lookup(0, 'propose_changes', { app: 'spending', title: says.purseTitle, steps: [step], next: false }, tokens)
}
