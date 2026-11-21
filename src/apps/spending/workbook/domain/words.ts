import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatPlainAmount } from '../../../../shared/money/moneyFormat'
import { labelWords, numberText } from '../../../../shared/storage/domain/recordCodec'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'
import type { DueProblem } from './budget'

// Croatian addresses the reader as vi, written lowercase inside a sentence. A field keeps its name as the file stores it, such as opened_on.
// An entry is unos, and a limit ograničenje.

/**
 * An entry as a write's message names it: its day and amount as the language writes them, and its payee, or the fields' text where
 * they hold neither. The amount has no currency sign, since the fields do not say which currency its account holds.
 */
function entryLabel(fields: StoredFields): string {
  const day = fields.date?.date ?? null
  const amount = fields.amount?.money ?? null
  return labelWords([day === null ? textOf(fields.date) : dayLabel(day), amount === null ? textOf(fields.amount) : formatPlainAmount(amount), textOf(fields.payee)])
}

/** The fields that hold the words a rule looks for, the payee's first, so a rule is named by what a person typed and never by a stored amount or key. */
const RULE_TEXT_FIELDS = ['payee_is', 'payee_contains', 'payee_starts_with', 'counterparty_contains', 'iban_is', 'counterparty_iban', 'description_contains', 'description_starts_with']

/** A rule as a write's message names it: the first words or IBAN it looks for. */
function ruleLabel(fields: StoredFields): string {
  const named = RULE_TEXT_FIELDS.map((name) => textOf(fields[name]).split('\n')[0] ?? '').find((text) => text !== '')
  return labelWords([named ?? ''])
}

export const en = {
  /** The words that name an entry, as its stored fields read. */
  entryLabel,
  /** The words that name a limit, as its stored fields read. */
  budgetLabel: (fields: StoredFields) => labelWords([textOf(fields.from), numberText(fields.amount)]),
  notACurrency: (text: string) => `currency "${text}" is not a currency code such as EUR or USD`,
  bankOnCash: 'bank is for a bank or savings account, not cash',
  ibanOnCash: 'iban is for a bank or savings account, not cash',
  bankLinkOnCash: 'rows_from bank-link is for a bank or savings account, since cash comes in by hand',
  alsoFromByHand: 'also_from is for an account the bank fills, since one kept by hand takes rows from anywhere',
  notCards: (text: string) => `cards "${text}" is not a list of four digits each, such as 3670, 1234`,
  cardsOnCash: 'cards is for a bank or savings account, not cash',
  bankLinkWithoutIban: 'takes its rows from a bank link but has no IBAN, so the bank sync cannot find it',
  notAFlag: (name: string, text: string) => `${name} "${text}" is neither true nor false`,
  notAWholeNumber: (name: string, text: string) => `${name} "${text}" is not a whole number`,
  notALink: (text: string) => `link "${text}" is not app/kind/key with a due date after it for an instalment, such as loans/bank-loan/<uuid>/2026-11-15`,
  notARuleLink: (text: string) => `link "${text}" is not app/kind/key with no due date, such as loans/bank-loan/<uuid>, since each row a rule links pays its own instalment`,
  ibanShared: (accounts: string, iban: string, currency: string) =>
    `your account ${accounts} already has the IBAN ${iban} in ${currency}. A bank such as Revolut gives each currency its own account under one IBAN, so give this one the currency it holds`,
  fixedWithParent: 'a fixed category has no parent',
  fixedShared: (kind: string) => `another category is of kind ${kind} too. Each of transfer, saving, company, repayment, informal-loan and asset is one category`,
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
  dueProblems: {
    'before-from': 'due is before from, so the first month it falls due is not its own',
    'too-far': 'due is a year or more after from, so it falls due before then too',
    'on-zero': 'due is on a budget of zero, which ends the limit',
  } satisfies Record<DueProblem, string>,
  notSpending: 'is on a category that is not spending, which no limit counts',
  budgetSharesMonth: (month: MonthKey) => `another limit of the category starts in ${month} too`,
  budgetOnGroupAndChild: 'is on a group and on one of its children in the same months, so no euro counts against two limits',
  accountOfStatementRow: 'a row a statement brought stays on its account, since the next statement finds it there by its key',
  byHandOnBankAccount: (account: string) => `${account} takes its rows from the bank link, so a typed or copied row, or a row of a file it does not allow, cannot go on it`,
  importKeyShared: (key: string) => `another entry of the account has the import key ${key} too`,
  heldRowNoKey: 'a bank row on hold carries the import key the sync gave it',
  heldRowBooked: (key: string) => `an entry of the account has its import key ${key}, so it is not on hold`,
  heldRowShared: (key: string) => `another bank row on hold of the account has the import key ${key} too`,
  ruleProblem: {
    'no-condition': 'a rule tests at least one thing, such as payee_contains',
    'repeated-test': 'a rule makes each test once, and once more turned around with not_',
    'no-value': 'a test lists a value on each line, an amount of zero or more, or an account or currency',
    'not-a-pattern': 'a regular expression the rule tests is not one',
    'not-days': 'days reads as two days of a month, the first not after the second, such as 1-15',
    'no-outcome': 'a rule files a category, adds labels, or both',
    'needs-category': 'a rule that spots cash taken out or pays a loan files into a category',
  },
  ruleOtherCondition: (column: string) => `Spending's rules read no ${column}`,
  notDays: (name: string, text: string) => `${name} "${text}" is not two days of a month such as 1-15`,
  notARuleCurrency: (name: string, text: string) => `${name} names "${text}", which is not a currency code such as EUR or USD`,
  cashAccountWithoutWithdrawal: 'cash_account names where a withdrawal goes, so it needs withdrawal set',
  withdrawalNotTransfer: 'spots a cash withdrawal, so it files into Between my accounts',
  withdrawalNotCash: 'names as the cash account one that is not a cash account in the file',
  ruleLabel,
  /** The words that name a receipt, as its stored fields read. */
  receiptLabel: (fields: StoredFields) => labelWords([textOf(fields.issued_at), numberText(fields.total), textOf(fields.merchant)]),
  /** The words that name a part of an entry, as its stored fields read. */
  partLabel: (fields: StoredFields) => labelWords([textOf(fields.note), textOf(fields.text), textOf(fields.printed), numberText(fields.amount)]),
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
  entryWithoutPart: 'has no part, so none of its money counts',
  itemLeftOut: 'another part of its entry is left out, so none of the entry counts',
  uncategorisedNotAlone: 'has no category, which only the one part of an entry waiting on To review may lack',
  transferLegSplit: 'is a part of a move between your accounts, which stays whole',
  lineAfterMove: 'is a part as files kept it before items, which a file moved to items no longer reads',
  labelNameShared: (name: string) => `another label is called ${name} too, so the two read as one`,
  noLabel: (key: string) => `names a label ${key} that is not in the file, so it shows under no label`,
  eventNameBlank: 'its name is blank',
  noShortcut: 'names no quick add in the file',
  shortcutMixedWays: 'goes the other way from another part of its quick add',
  shortcutBetweenAccounts: 'is filed under Between my accounts, which a quick add cannot write',
  shortcutNoLabel: 'names a label that is not in the file',
  shortcutPartLeftOut: 'another part of its quick add is left out, so none of it counts',
  shortcutWithoutPart: 'has no part, so it writes nothing',
  eventEndsBefore: 'its last day is before its first',
  noEvent: (key: string) => `names an event ${key} that is not in the file, so it joins an event by its day`,
  settingNotADay: (key: string, text: string) => `${key} "${text}" is not a date such as 2027-05-03`,
  settingNotATime: (key: string, text: string) => `${key} "${text}" is not a UTC time such as 2026-11-09T07:40:00.000Z`,
  settingNotABankAccount: (key: string, line: string) => `${key} line "${line}" is not an IBAN and a currency such as LT000000000000000001 USD`,
  settingNotAPutOff: (key: string, line: string) => `${key} line "${line}" is not a loan's key and a day such as fa4e0000-0000-4000-8000-000000000001 2026-10-20`,
  /** Each setting by the label its screen shows, which a change to it and any sentence naming it read. */
  settingLabels: {
    application: 'Enable Banking application ID',
    personPayees: 'Payees who are people',
    notInKuna: 'Bank accounts not in Kuna',
    keepMine: 'Accounts that keep their own bank and kind',
    instalmentsPutOff: 'Past instalments put off',
    companyRolesPutOff: 'Where payments from Company file, put off',
    companyPaymentsPutOff: 'Payments with Company put off',
    bankLink: (bank: string) => `${bank} link expiry`,
    bankFetched: (bank: string) => `Last answer from ${bank}`,
  },
}

export const hr: Translation<typeof en> = {
  entryLabel,
  budgetLabel: (fields) => labelWords([fields.from === undefined ? '' : monthLabelOf(textOf(fields.from)), numberText(fields.amount)]),
  notACurrency: (text) => `currency „${text}” nije oznaka valute kao EUR ili USD`,
  bankOnCash: 'bank vrijedi za bankovni ili štedni račun, ne za gotovinu',
  ibanOnCash: 'iban vrijedi za bankovni ili štedni račun, ne za gotovinu',
  bankLinkOnCash: 'rows_from bank-link vrijedi za bankovni ili štedni račun, jer se gotovina unosi ručno',
  alsoFromByHand: 'also_from vrijedi za račun koji puni banka, jer ručno vođen račun prima retke odasvud',
  notCards: (text) => `cards „${text}” nije popis od po četiri znamenke, kao 3670, 1234`,
  cardsOnCash: 'cards vrijedi za bankovni ili štedni račun, ne za gotovinu',
  bankLinkWithoutIban: 'retke dobiva iz povezane banke, ali nema IBAN, pa ga sinkronizacija s bankom ne može pronaći',
  notAFlag: (name, text) => `${name} „${text}” nije ni true ni false`,
  notAWholeNumber: (name, text) => `${name} „${text}” nije cijeli broj`,
  notALink: (text) => `link „${text}” nije oblika aplikacija/vrsta/ključ, s datumom dospijeća iza njega za ratu, primjerice loans/bank-loan/<uuid>/2026-11-15`,
  notARuleLink: (text) => `link „${text}” nije oblika aplikacija/vrsta/ključ bez datuma dospijeća, primjerice loans/bank-loan/<uuid>, jer svaki redak koji pravilo poveže plaća svoju ratu`,
  ibanShared: (accounts, iban, currency) =>
    `vaš račun ${accounts} već ima IBAN ${iban} u valuti ${currency}. Banka kao Revolut daje svakoj valuti zaseban račun pod istim IBAN-om, pa postavite valutu u kojoj se ovaj račun vodi`,
  fixedWithParent: 'stalna kategorija nema nadređenu',
  fixedShared: (kind) => `i druga kategorija je vrste „${kind}”. Svaka od vrsta „transfer”, „saving”, „company”, „repayment”, „informal-loan” i „asset” jedna je kategorija`,
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
  dueProblems: {
    'before-from': 'due je prije from, pa prvi mjesec dospijeća nije njegov',
    'too-far': 'due je godinu dana ili više nakon from, pa dospijeva i prije toga',
    'on-zero': 'due je na ograničenju od nule, koje završava ograničenje',
  },
  notSpending: 'je na kategoriji koja nije potrošnja, pa je ograničenje ne broji',
  budgetSharesMonth: (month) => `i drugo ograničenje te kategorije počinje u mjesecu ${monthLabel(month)}`,
  budgetOnGroupAndChild: 'je na skupini i na jednoj od njezinih podređenih kategorija u istim mjesecima, pa se nijedan euro ne broji u dva ograničenja',
  accountOfStatementRow: 'stavka iz izvoda ostaje na svom računu jer je sljedeći izvod tamo pronalazi po ključu',
  byHandOnBankAccount: (account) => `${account} dobiva retke iz veze s bankom, pa se na njega ne može upisati ni prepisati redak, ni dodati redak datoteke koju ne dopušta`,
  importKeyShared: (key) => `i drugi unos računa ima ključ uvoza ${key}`,
  heldRowNoKey: 'redak iz banke na čekanju nosi ključ uvoza koji mu je dala sinkronizacija',
  heldRowBooked: (key) => `unos računa ima njegov ključ uvoza ${key}, pa nije na čekanju`,
  heldRowShared: (key) => `i drugi redak iz banke na čekanju na tom računu ima ključ uvoza ${key}`,
  ruleProblem: {
    'no-condition': 'pravilo provjerava barem jedno, primjerice payee_contains',
    'repeated-test': 'pravilo svaku provjeru radi jednom, i još jednom obrnuto',
    'no-value': 'provjera navodi vrijednost u svakom retku, iznos od nule naviše, ili račun ili valutu',
    'not-a-pattern': 'regularni izraz koji pravilo provjerava nije ispravan',
    'not-days': 'days se čita kao dva dana u mjesecu, prvi ne poslije drugog, primjerice 1-15',
    'no-outcome': 'pravilo razvrstava u kategoriju, dodaje oznake ili oboje',
    'needs-category': 'pravilo koje prepoznaje podizanje gotovine ili plaća kredit razvrstava u kategoriju',
  },
  ruleOtherCondition: (column) => `pravila potrošnje ne čitaju ${column}`,
  notDays: (name, text) => `${name} „${text}” nisu dva dana u mjesecu kao 1-15`,
  notARuleCurrency: (name, text) => `${name} navodi „${text}”, što nije oznaka valute kao EUR ili USD`,
  cashAccountWithoutWithdrawal: 'cash_account navodi kamo ide podizanje gotovine, pa traži postavljen withdrawal',
  withdrawalNotTransfer: 'prepoznaje podizanje gotovine, pa razvrstava u Između mojih računa',
  withdrawalNotCash: 'kao račun gotovine navodi račun koji u datoteci nije gotovina',
  ruleLabel,
  receiptLabel: (fields) => labelWords([textOf(fields.issued_at), numberText(fields.total), textOf(fields.merchant)]),
  partLabel: (fields) => labelWords([textOf(fields.note), textOf(fields.text), textOf(fields.printed), numberText(fields.amount)]),
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
  entryWithoutPart: 'nema nijedan dio, pa se nijedan njegov novac ne broji',
  itemLeftOut: 'drugi dio istog unosa je izostavljen, pa se unos ne broji',
  uncategorisedNotAlone: 'nema kategoriju, a bez nje smije biti samo jedini dio unosa koji čeka pod Za pregled',
  transferLegSplit: 'dio je prijenosa između vaših računa, a on ostaje cijeli',
  lineAfterMove: 'dio je zapisan kao prije dijelova unosa, a datoteka prebačena na dijelove takav više ne čita',
  labelNameShared: (name) => `i druga se oznaka zove ${name}, pa se obje čitaju kao jedna`,
  noLabel: (key) => `navodi oznaku ${key} koje nema u datoteci, pa se ne vidi ni pod jednom oznakom`,
  eventNameBlank: 'naziv mu je prazan',
  noShortcut: 'u datoteci nema brzog unosa koji navodi',
  shortcutMixedWays: 'ide u drugom smjeru od drugog dijela istog brzog unosa',
  shortcutBetweenAccounts: 'stoji pod Između mojih računa, a to brzi unos ne može upisati',
  shortcutNoLabel: 'navodi oznaku koje nema u datoteci',
  shortcutPartLeftOut: 'drugi dio istog brzog unosa je izostavljen, pa se ništa od njega ne broji',
  shortcutWithoutPart: 'nema nijedan dio, pa ništa ne upisuje',
  eventEndsBefore: 'zadnji mu je dan prije prvog',
  noEvent: (key) => `navodi događaj ${key} kojeg nema u datoteci, pa se događaju pridružuje po svom danu`,
  settingNotADay: (key, text) => `${key} „${text}” nije datum kao 2027-05-03`,
  settingNotATime: (key, text) => `${key} „${text}” nije UTC vrijeme kao 2026-11-09T07:40:00.000Z`,
  settingNotABankAccount: (key, line) => `${key} redak „${line}” nije IBAN i valuta kao LT000000000000000001 USD`,
  settingNotAPutOff: (key, line) => `${key} redak „${line}” nije ključ kredita i dan kao fa4e0000-0000-4000-8000-000000000001 2026-10-20`,
  settingLabels: {
    application: 'ID aplikacije Enable Banking',
    personPayees: 'Primatelji koji su osobe',
    notInKuna: 'Bankovni računi koji nisu u Kuni',
    keepMine: 'Računi koji zadržavaju svoju banku i vrstu',
    instalmentsPutOff: 'Odgođene prošle rate',
    companyRolesPutOff: 'Odgođeno pitanje kamo idu isplate iz Tvrtke',
    companyPaymentsPutOff: 'Odgođena plaćanja s Tvrtkom',
    bankLink: (bank) => `Istek veze s bankom ${bank}`,
    bankFetched: (bank) => `Zadnji odgovor banke ${bank}`,
  },
}

/** A stored month as Croatian names it, or the text as it is when it is no month. */
function monthLabelOf(text: string): string {
  const month = parseMonthKey(text)
  return month === null ? text : monthLabel(month)
}

export const words = language === 'hr' ? hr : en
