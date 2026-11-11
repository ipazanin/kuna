import type { CivilDate } from '../../../../shared/calendar/civilDate'
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
  bankLinkOnCash: 'rows_from bank-link is for a bank or savings account, since cash comes in by hand',
  bankLinkWithoutIban: 'takes its rows from a bank link but has no IBAN, so the bank sync cannot find it',
  notAFlag: (name: string, text: string) => `${name} "${text}" is neither true nor false`,
  notAWholeNumber: (name: string, text: string) => `${name} "${text}" is not a whole number`,
  ibanShared: (accounts: string, iban: string, currency: string) =>
    `your account ${accounts} already has the IBAN ${iban} in ${currency}. A bank such as Revolut gives each currency its own account under one IBAN, so give this one the currency it holds`,
  fixedWithParent: 'a fixed category has no parent',
  fixedShared: (kind: string) => `another category is of kind ${kind} too. Each of transfer, saving and company is one category`,
  noParent: 'names a parent that is not in the file',
  parentHasParent: 'names a parent that is itself a child. Categories go two levels deep',
  parentOfOtherKind: 'names a parent of another kind',
  amountIsZero: 'amount is zero',
  noAccount: 'names no account in the file',
  beforeStartDay: (day: CivilDate) => `is from before its account's start day ${day}, so it counts nowhere`,
  noCategory: 'names no category in the file',
  pairOnSameAccount: 'names as its other leg a row on the same account',
  pairNotBack: 'names as its other leg a row that does not name it back',
  notAMonth: (name: string, text: string) => `${name} "${text}" is not a month such as 2026-11`,
  amountBelowZero: 'amount is below zero',
  notSpending: 'is on a category that is not spending, which no limit counts',
  budgetSharesMonth: (month: MonthKey) => `another limit of the category starts in ${month} too`,
  budgetOnGroupAndChild: 'is on a group and on one of its children in the same months, so no euro counts against two limits',
  accountOfStatementRow: 'a row a statement brought stays on its account, since the next statement finds it there by its key',
  byHandOnBankAccount: (account: string) => `${account} takes its rows from the bank, so a typed or copied row cannot go on it`,
  importKeyShared: (key: string) => `another entry of the account has the import key ${key} too`,
  heldRowNoKey: 'a bank row on hold carries the import key the sync gave it',
  heldRowBooked: (key: string) => `an entry of the account has its import key ${key}, so it is not on hold`,
  heldRowShared: (key: string) => `another bank row on hold of the account has the import key ${key} too`,
  ruleNeedsOneCondition: 'a rule states counterparty_contains or counterparty_iban, and only one of them',
  ruleOtherCondition: (column: string) => `Spending's rules read no ${column}`,
  cashAccountWithoutWithdrawal: 'cash_account names where a withdrawal goes, so it needs withdrawal set',
  withdrawalNotTransfer: 'spots a cash withdrawal, so it files into Between my accounts',
  withdrawalNotCash: 'names as the cash account one that is not a cash account in the file',
  ruleLabel: (fields: StoredFields) => labelWords([textOf(fields.counterparty_contains), textOf(fields.counterparty_iban)]),
  /** The words that name a receipt, as its stored fields read. */
  receiptLabel: (fields: StoredFields) => labelWords([textOf(fields.issued_at), numberText(fields.total), textOf(fields.merchant)]),
  /** The words that name a part of an entry, as its stored fields read. */
  partLabel: (fields: StoredFields) => labelWords([textOf(fields.text), textOf(fields.printed), numberText(fields.amount)]),
  notIssuedAt: (text: string) => `issued_at "${text}" is not a date, or a date and time, such as 2026-11-03 18:42`,
  totalNotAboveZero: 'total is not above zero',
  noEntry: 'names no entry in the file',
  noReceipt: 'names no receipt of its entry in the file',
  receiptEntryOrAccount: 'names neither an entry nor the account it waits on, or names both',
  partEntryOrReceipt: 'names neither an entry nor a receipt',
  waitingOnNoAccount: 'waits on an account that is not in the file',
  entryHasReceipt: 'names an entry another receipt names too',
  fiscalCodeShared: 'another receipt holds the same JIR or ZKI, which name one fiscal receipt',
  siblingPartLeftOut: 'another part of its entry is left out, so the entry counts under its own category',
  partsDoNotAddUp: (sum: string, amount: string) => `the parts of its entry add up to ${sum}, and the entry says ${amount}`,
  settingNotADay: (key: string, text: string) => `${key} "${text}" is not a date such as 2027-05-03`,
  settingNotATime: (key: string, text: string) => `${key} "${text}" is not a UTC time such as 2026-11-09T07:40:00.000Z`,
  settingNotABankAccount: (key: string, line: string) => `${key} line "${line}" is not an IBAN and a currency such as LT000000000000000001 USD`,
  /** Each setting by the label its screen shows, which a change to it and any sentence naming it read. */
  settingLabels: {
    deployment: 'Script deployment ID',
    companyOib: 'Company OIB',
    personPayees: 'Payees who are people',
    notInKuna: 'Bank accounts not in Kuna',
    keepMine: 'Accounts that keep their own bank and kind',
    bankLink: (bank: string) => `${bank} link expiry`,
    bankFetched: (bank: string) => `Last answer from ${bank}`,
  },
  /** Sentences that name a setting, kept beside its label so a rename sees them. */
  settingSentences: {
    companyOibSaved: 'Company OIB saved',
  },
}

export const hr: Translation<typeof en> = {
  entryLabel: croatianEntryLabel,
  budgetLabel: (fields) => labelWords([fields.from === undefined ? '' : monthLabelOf(textOf(fields.from)), numberText(fields.amount)]),
  notACurrency: (text) => `currency „${text}” nije oznaka valute kao EUR ili USD`,
  bankOnCash: 'bank vrijedi za bankovni ili štedni račun, ne za gotovinu',
  ibanOnCash: 'iban vrijedi za bankovni ili štedni račun, ne za gotovinu',
  bankLinkOnCash: 'rows_from bank-link vrijedi za bankovni ili štedni račun, jer se gotovina unosi ručno',
  bankLinkWithoutIban: 'retke dobiva iz povezane banke, ali nema IBAN, pa ga sinkronizacija s bankom ne može pronaći',
  notAFlag: (name, text) => `${name} „${text}” nije ni true ni false`,
  notAWholeNumber: (name, text) => `${name} „${text}” nije cijeli broj`,
  ibanShared: (accounts, iban, currency) =>
    `vaš račun ${accounts} već ima IBAN ${iban} u valuti ${currency}. Banka kao Revolut daje svakoj valuti zaseban račun pod istim IBAN-om, pa postavite valutu u kojoj se ovaj račun vodi`,
  fixedWithParent: 'stalna kategorija nema nadređenu',
  fixedShared: (kind) => `i druga kategorija je vrste „${kind}”. Svaka od vrsta „transfer”, „saving” i „company” jedna je kategorija`,
  noParent: 'navodi nadređenu kategoriju koje nema u datoteci',
  parentHasParent: 'navodi nadređenu kategoriju koja je i sama podređena. Kategorije imaju dvije razine',
  parentOfOtherKind: 'navodi nadređenu kategoriju druge vrste',
  amountIsZero: 'amount je nula',
  noAccount: 'u datoteci nema računa koji navodi',
  beforeStartDay: (day) => `je iz vremena prije početnog dana računa, ${dayLabel(day)}, pa se nigdje ne broji`,
  noCategory: 'u datoteci nema kategorije koju navodi',
  pairOnSameAccount: 'kao drugu stranu navodi stavku na istom računu',
  pairNotBack: 'kao drugu stranu navodi stavku koja ne navodi nju',
  notAMonth: (name, text) => `${name} „${text}” nije mjesec kao 2026-11`,
  amountBelowZero: 'amount je manji od nule',
  notSpending: 'je na kategoriji koja nije potrošnja, pa je ograničenje ne broji',
  budgetSharesMonth: (month) => `i drugo ograničenje te kategorije počinje u mjesecu ${monthLabel(month)}`,
  budgetOnGroupAndChild: 'je na skupini i na jednoj od njezinih podređenih kategorija u istim mjesecima, pa se nijedan euro ne broji u dva ograničenja',
  accountOfStatementRow: 'stavka iz izvoda ostaje na svom računu jer je sljedeći izvod tamo pronalazi po ključu',
  byHandOnBankAccount: (account) => `${account} dobiva retke iz banke, pa se na njega ne može upisati ni prepisati redak`,
  importKeyShared: (key) => `i drugi unos računa ima ključ uvoza ${key}`,
  heldRowNoKey: 'redak iz banke na čekanju nosi ključ uvoza koji mu je dala sinkronizacija',
  heldRowBooked: (key) => `unos računa ima njegov ključ uvoza ${key}, pa nije na čekanju`,
  heldRowShared: (key) => `i drugi redak iz banke na čekanju na tom računu ima ključ uvoza ${key}`,
  ruleNeedsOneCondition: 'pravilo navodi counterparty_contains ili counterparty_iban, i samo jedno od njih',
  ruleOtherCondition: (column) => `pravila potrošnje ne čitaju ${column}`,
  cashAccountWithoutWithdrawal: 'cash_account navodi kamo ide podizanje gotovine, pa traži postavljen withdrawal',
  withdrawalNotTransfer: 'prepoznaje podizanje gotovine, pa razvrstava u Između mojih računa',
  withdrawalNotCash: 'kao račun gotovine navodi račun koji u datoteci nije gotovina',
  ruleLabel: (fields) => labelWords([textOf(fields.counterparty_contains), textOf(fields.counterparty_iban)]),
  receiptLabel: (fields) => labelWords([textOf(fields.issued_at), numberText(fields.total), textOf(fields.merchant)]),
  partLabel: (fields) => labelWords([textOf(fields.text), textOf(fields.printed), numberText(fields.amount)]),
  notIssuedAt: (text) => `issued_at „${text}” nije datum, ni datum i vrijeme, kao 2026-11-03 18:42`,
  totalNotAboveZero: 'total nije veći od nule',
  noEntry: 'u datoteci nema unosa koji navodi',
  noReceipt: 'u datoteci nema fiskalnog računa njegova unosa koji navodi',
  receiptEntryOrAccount: 'ne navodi ni unos ni račun na kojem čeka, ili navodi oboje',
  partEntryOrReceipt: 'ne navodi ni unos ni fiskalni račun',
  waitingOnNoAccount: 'čeka na računu kojeg nema u datoteci',
  entryHasReceipt: 'navodi unos koji navodi i drugi fiskalni račun',
  fiscalCodeShared: 'isti JIR ili ZKI ima i drugi fiskalni račun, a oni označavaju jedan fiskalni račun',
  siblingPartLeftOut: 'drugi dio istog unosa je izostavljen, pa se unos broji pod svojom kategorijom',
  partsDoNotAddUp: (sum, amount) => `dijelovi istog unosa daju ${sum}, a na unosu piše ${amount}`,
  settingNotADay: (key, text) => `${key} „${text}” nije datum kao 2027-05-03`,
  settingNotATime: (key, text) => `${key} „${text}” nije UTC vrijeme kao 2026-11-09T07:40:00.000Z`,
  settingNotABankAccount: (key, line) => `${key} redak „${line}” nije IBAN i valuta kao LT000000000000000001 USD`,
  settingLabels: {
    deployment: 'ID implementacije skripte',
    companyOib: 'OIB tvrtke',
    personPayees: 'Primatelji koji su osobe',
    notInKuna: 'Bankovni računi koji nisu u Kuni',
    keepMine: 'Računi koji zadržavaju svoju banku i vrstu',
    bankLink: (bank) => `Istek veze s bankom ${bank}`,
    bankFetched: (bank) => `Zadnji odgovor banke ${bank}`,
  },
  settingSentences: {
    companyOibSaved: 'OIB tvrtke je spremljen',
  },
}

/** A stored month as Croatian names it, or the text as it is when it is no month. */
function monthLabelOf(text: string): string {
  const month = parseMonthKey(text)
  return month === null ? text : monthLabel(month)
}

export const words = language === 'hr' ? hr : en
