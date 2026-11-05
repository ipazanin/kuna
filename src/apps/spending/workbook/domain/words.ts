import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { dayText, labelWords, numberText } from '../../../../shared/storage/domain/recordCodec'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A field keeps its name as the file stores it, such as opened_on.
// English keeps the file's dates, and Croatian writes them its own way. An entry is unos, and a limit ograničenje.

/** An entry as Croatian names it: its day, amount and payee as Croatian writes them, or the fields' text where they hold neither. */
function croatianEntryLabel(fields: StoredFields): string {
  const day = fields.date?.date ?? null
  const amount = fields.amount?.money ?? null
  return labelWords([day === null ? textOf(fields.date) : dayLabel(day), amount === null ? textOf(fields.amount) : formatMoney(amount), textOf(fields.payee)])
}

export const en = {
  /** The words that name an entry, as its stored fields read. */
  entryLabel: (fields: StoredFields) => labelWords([dayText(fields.date), numberText(fields.amount), textOf(fields.payee)]),
  /** The words that name a limit, as its stored fields read. */
  budgetLabel: (fields: StoredFields) => labelWords([textOf(fields.from), numberText(fields.amount)]),
  notACurrency: (text: string) => `currency "${text}" is not a currency code such as EUR or USD`,
  bankOnCash: 'bank is for a bank or savings account, not cash',
  ibanOnCash: 'iban is for a bank or savings account, not cash',
  notAFlag: (name: string, text: string) => `${name} "${text}" is neither true nor false`,
  notAWholeNumber: (name: string, text: string) => `${name} "${text}" is not a whole number`,
  ibanShared: (iban: string, currency: string) => `another account in ${currency} has the IBAN ${iban} too`,
  fixedWithParent: 'a fixed category has no parent',
  fixedShared: (kind: string) => `another category is of kind ${kind} too. Each of transfer, saving and company is one category`,
  noParent: 'names a parent that is not in the file',
  parentHasParent: 'names a parent that is itself a child. Categories go two levels deep',
  parentOfOtherKind: 'names a parent of another kind',
  amountIsZero: 'amount is zero',
  noAccount: 'names no account in the file',
  noCategory: 'names no category in the file',
  pairOnSameAccount: 'names as its other leg a row on the same account',
  pairNotBack: 'names as its other leg a row that does not name it back',
  notAMonth: (name: string, text: string) => `${name} "${text}" is not a month such as 2026-11`,
  amountBelowZero: 'amount is below zero',
  notSpending: 'is on a category that is not spending, which no limit counts',
  budgetSharesMonth: (month: MonthKey) => `another limit of the category starts in ${month} too`,
  budgetOnGroupAndChild: 'is on a group and on one of its children in the same months, so no euro counts against two limits',
  accountOfStatementRow: 'a row a statement brought stays on its account, since the next statement finds it there by its key',
  importKeyShared: (key: string) => `another entry of the account has the import key ${key} too`,
  ruleNeedsOneCondition: 'a rule states counterparty_contains or counterparty_iban, and only one of them',
  ruleOtherCondition: (column: string) => `Spending's rules read no ${column}`,
  ruleLabel: (fields: StoredFields) => labelWords([textOf(fields.counterparty_contains), textOf(fields.counterparty_iban)]),
}

export const hr: Translation<typeof en> = {
  entryLabel: croatianEntryLabel,
  budgetLabel: (fields) => labelWords([fields.from === undefined ? '' : monthLabelOf(textOf(fields.from)), numberText(fields.amount)]),
  notACurrency: (text) => `currency „${text}” nije oznaka valute kao EUR ili USD`,
  bankOnCash: 'bank vrijedi za bankovni ili štedni račun, ne za gotovinu',
  ibanOnCash: 'iban vrijedi za bankovni ili štedni račun, ne za gotovinu',
  notAFlag: (name, text) => `${name} „${text}” nije ni true ni false`,
  notAWholeNumber: (name, text) => `${name} „${text}” nije cijeli broj`,
  ibanShared: (iban, currency) => `i drugi račun u valuti ${currency} ima IBAN ${iban}`,
  fixedWithParent: 'stalna kategorija nema nadređenu',
  fixedShared: (kind) => `i druga kategorija je vrste „${kind}”. Svaka od vrsta „transfer”, „saving” i „company” jedna je kategorija`,
  noParent: 'navodi nadređenu kategoriju koje nema u datoteci',
  parentHasParent: 'navodi nadređenu kategoriju koja je i sama podređena. Kategorije imaju dvije razine',
  parentOfOtherKind: 'navodi nadređenu kategoriju druge vrste',
  amountIsZero: 'amount je nula',
  noAccount: 'u datoteci nema računa koji navodi',
  noCategory: 'u datoteci nema kategorije koju navodi',
  pairOnSameAccount: 'kao drugu stranu navodi stavku na istom računu',
  pairNotBack: 'kao drugu stranu navodi stavku koja ne navodi nju',
  notAMonth: (name, text) => `${name} „${text}” nije mjesec kao 2026-11`,
  amountBelowZero: 'amount je manji od nule',
  notSpending: 'je na kategoriji koja nije potrošnja, pa je ograničenje ne broji',
  budgetSharesMonth: (month) => `i drugo ograničenje te kategorije počinje u mjesecu ${monthLabel(month)}`,
  budgetOnGroupAndChild: 'je na skupini i na jednoj od njezinih podređenih kategorija u istim mjesecima, pa se nijedan euro ne broji u dva ograničenja',
  accountOfStatementRow: 'stavka iz izvoda ostaje na svom računu jer je sljedeći izvod tamo pronalazi po ključu',
  importKeyShared: (key) => `i drugi unos računa ima ključ uvoza ${key}`,
  ruleNeedsOneCondition: 'pravilo navodi counterparty_contains ili counterparty_iban, i samo jedno od njih',
  ruleOtherCondition: (column) => `pravila potrošnje ne čitaju ${column}`,
  ruleLabel: (fields) => labelWords([textOf(fields.counterparty_contains), textOf(fields.counterparty_iban)]),
}

/** A stored month as Croatian names it, or the text as it is when it is no month. */
function monthLabelOf(text: string): string {
  const month = parseMonthKey(text)
  return month === null ? text : monthLabel(month)
}

export const words = language === 'hr' ? hr : en
