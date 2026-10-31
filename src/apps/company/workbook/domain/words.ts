import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { dayText, labelWords, labelled, numberText } from '../../../../shared/storage/domain/recordCodec'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'
import { slugInWords } from './slugInWords'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A ledger row on screen is stavka and a row of a tab in the file redak. A field keeps its name as the file stores it, such as owner_share.

/** What a name in its slug format names, which the slug checks word as such. */
export type SlugNoun = 'category' | 'account' | 'client' | 'grant' | 'scenario' | 'employee'

/** A Croatian noun alone and of one, as in "kategorija" and "naziv kategorije". */
const SLUG_NOUNS: Readonly<Record<SlugNoun, { readonly one: string; readonly of: string }>> = {
  category: { one: 'kategorija', of: 'kategorije' },
  account: { one: 'račun u banci', of: 'računa u banci' },
  client: { one: 'klijent', of: 'klijenta' },
  grant: { one: 'potpora', of: 'potpore' },
  scenario: { one: 'scenarij', of: 'scenarija' },
  employee: { one: 'zaposlenik', of: 'zaposlenika' },
}

/** "a category", "an account". */
function withArticle(noun: string): string {
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`
}

/** The names of the categories and families new books start with, as Croatian screens show them while the file gives no label. */
const SEEDED_NAMES: ReadonlyMap<string, string> = new Map([
  ['income', 'Prihodi'],
  ['operating', 'Poslovni rashodi'],
  ['taxes', 'Porezi'],
  ['owner', 'Vlasnik'],
  ['financing', 'Financiranje'],
  ['neutral', 'Neutralno'],
  ['revenue', 'Prihod'],
  ['other-income', 'Ostali prihodi'],
  ['interest-income', 'Prihodi od kamata'],
  ['client-refund', 'Povrat klijentu'],
  ['software', 'Softver'],
  ['equipment', 'Oprema'],
  ['contractors', 'Vanjski suradnici'],
  ['accounting-and-legal', 'Računovodstvo i pravne usluge'],
  ['office-rent', 'Najam ureda'],
  ['office-supplies', 'Uredski materijal'],
  ['travel', 'Putovanja'],
  ['client-meals', 'Reprezentacija'],
  ['marketing', 'Marketing'],
  ['telecom', 'Telekomunikacije'],
  ['insurance', 'Osiguranje'],
  ['training', 'Edukacija'],
  ['bank-fees', 'Bankovne naknade'],
  ['other-costs', 'Ostali troškovi'],
  ['vat-refund', 'Povrat PDV-a'],
  ['income-tax', 'Porez na dohodak'],
  ['vat', 'PDV'],
  ['payroll-tax', 'Porez na plaću'],
  ['social-contributions', 'Doprinosi'],
  ['tax-refund', 'Povrat poreza'],
  ['owner-salary', 'Plaća vlasnika'],
  ['owner-dividend', 'Dividenda vlasniku'],
  ['owner-drawings', 'Isplate vlasniku'],
  ['benefits-from-company-costs', 'Koristi od troškova tvrtke'],
  ['loan-received', 'Primljeni zajam'],
  ['loan-repayment', 'Otplata zajma'],
  ['owner-reimbursement', 'Povrat troškova vlasniku'],
  ['internal-transfer', 'Interni prijenos'],
  ['owner-capital', 'Kapital vlasnika'],
])

/** A date field as the day Croatian writes, anything else as its text. */
export function dayInWords(field: StoredField | undefined): string {
  const day = field?.date ?? null
  return day === null ? textOf(field) : dayLabel(day)
}

/** An amount field as Croatian writes the money, anything else as its text. */
export function moneyInWords(field: StoredField | undefined): string {
  const money = field?.money ?? null
  return money === null ? textOf(field) : formatMoney(money)
}

/** The ledger row a split is kept by, as Croatian names it. */
function croatianRow(account: string, date: CivilDate, amount: Money, balance: Money): string {
  return `stavka računa ${account} od ${dayLabel(date)} s iznosom ${formatMoney(amount)} i saldom ${formatMoney(balance)}`
}

export const en = {
  /** The words that name a record of each kind, as its stored fields read. */
  labels: {
    ledgerRow: (fields: StoredFields) =>
      labelWords([dayText(fields.date), textOf(fields.counterparty) || textOf(fields.description), numberText(fields.amount), labelled('balance', numberText(fields.balance))]),
    splitPart: (fields: StoredFields) => labelWords([textOf(fields.category), numberText(fields.amount), dayText(fields.date)]),
    dismissal: (fields: StoredFields) => labelWords([textOf(fields.key), dayText(fields.dismissed_on)]),
    billingItem: (fields: StoredFields) => labelWords([textOf(fields.item), textOf(fields.client), dayText(fields.date), numberText(fields.amount)]),
  },
  /** What a category or family is called while the file gives it no label: Kuna's name for one new books start with, else its slug in words. */
  unlabelled: (slug: string) => slugInWords(slug),
  swatches: { green: 'Green', orange: 'Orange', blue: 'Blue', amber: 'Amber', pink: 'Pink', darkGreen: 'Dark green', violet: 'Violet', red: 'Red', grey: 'Grey' },
  categories: {
    notAllFilled: 'category, family and bucket are not all filled',
    notABucket: (bucket: string) => `"${bucket}" is not a bucket`,
    unknownVat: (vat: string, slug: string) => `vat "${vat}" is not a VAT treatment, so ${slug} reads as none`,
    definedTwice: (slug: string) => `"${slug}" is defined on more than one row, so none of them counts`,
  },
  ledger: {
    noDate: 'no date',
    notADateCell: (text: string) => `the date "${text}" is not a date cell`,
    noAccount: 'no account',
    noAmount: (field: string) => `no ${field}`,
    notANumber: (field: string, text: string) => `the ${field} "${text}" is not a number`,
  },
  splits: {
    noAccount: 'no account',
    noRow: (account: string, date: CivilDate, amount: Money, balance: Money) =>
      `the ledger holds no ${account} row of ${date} with the amount ${plainAmount(amount)} and the balance ${plainAmount(balance)}`,
    severalRows: (count: number, account: string, date: CivilDate, amount: Money, balance: Money) =>
      `${count} ledger rows are the ${account} row of ${date} with the amount ${plainAmount(amount)} and the balance ${plainAmount(balance)}`,
    sharesKey: (account: string, date: CivilDate, amount: Money, balance: Money) =>
      `the ${account} row of ${date} with the amount ${plainAmount(amount)} and the balance ${plainAmount(balance)} shares its key with another ledger row`,
    unreadableParts: (count: number): EnglishForms => ({ one: 'a part of this split cannot be read', other: `${count} parts of this split cannot be read` }),
    onePart: 'a split has at least two parts, and this one has one',
    partZero: (label: string) => `the part "${label}" is zero`,
    partOtherSign: (label: string) => `the part "${label}" has the other sign to the row`,
    partNoCategory: (label: string) => `the part "${label}" has no category`,
    partNotOnTab: (category: string, label: string) => `"${category}" of the part "${label}" is not on the categories tab`,
    partsAddUp: (total: Money, row: Money) => `the parts add up to ${plainAmount(total)} and the row is ${plainAmount(row)}`,
    countsWhole: (reasons: string) => `${reasons}, so the ledger row counts whole`,
    keptWhole: (account: string, date: CivilDate, why: string) => `the ${account} row of ${date} stays whole, since ${why}`,
    refusedKeptWhole: (account: string, date: CivilDate, amount: Money, why: string) => `The ${account} row of ${date} for ${plainAmount(amount)} stays whole, since ${why}.`,
  },
  accounts: {
    noName: 'no account name',
    otherCurrency: (slug: string, currency: string, workbook: string) => `${slug} is in ${currency} but the workbook counts in ${workbook}, so its amounts read as ${workbook}`,
    namedTwice: (slug: string) => `${slug} is named on more than one row, so none of them counts`,
  },
  dismissals: {
    noKey: 'no key',
    dismissedTwice: (key: string) => `${key} is dismissed on more than one row, so none of them counts`,
  },
  invoices: {
    noNumber: 'no invoice number',
    noClient: 'no client',
    notANumber: (amount: string) => `the amount "${amount}" is not a number`,
    issuedNotADate: (issued: string) => `the issue date "${issued}" is not a date cell`,
    dueNotADate: (due: string) => `the due date "${due}" is not a date cell`,
    listedTwice: (number: string, client: string) => `invoice ${number} for ${client} is listed on more than one row, so none of them counts`,
    clientMissing: (client: string, number: string) => `${client} is not on the clients tab, so no payment can be matched to invoice ${number}`,
    periodUnread: (refused: string) => `${refused}, so the issue date stands for the delivery period`,
  },
  clients: {
    noName: 'no client name',
    noIban: 'no IBAN',
    unknownLanguage: (tag: string) => `"${tag}" is not a language such as en or hr, so the mail is written in English`,
    reverseCharge: (text: string) => `reverse_charge "${text}" is neither TRUE nor FALSE, so it reads as FALSE`,
    onSeveralRows: (slug: string, rows: number) => `${slug} is on ${rows} rows, so none of them counts. Put all its IBANs in the first row, separated by commas, and delete the others`,
    sharedIban: (iban: string) => `${iban} is on another client too, so a payment from it counts for neither`,
  },
  billing: {
    noItem: 'no item',
    noDate: 'no date',
    noClient: 'no client',
    clientMissing: (client: string) => `"${client}" is not on the clients tab`,
  },
  slugs: {
    needsName: (noun: SlugNoun) => `${capitalised(withArticle(noun))} needs a name`,
    notAName: (slug: string, noun: SlugNoun) => `"${slug}" is not ${withArticle(noun)} name the app can use: write it in lower-case letters and digits with single hyphens, such as ai-services`,
    addedTwice: (slug: string) => `"${slug}" is added twice.`,
    already: (slug: string, noun: SlugNoun) => `"${slug}" is already ${withArticle(noun)}.`,
    inUse: (slug: string, deleted: boolean, users: string) => `"${slug}" cannot be ${deleted ? 'deleted' : 'renamed'}, since it is used by ${users}.`,
  },
}

export const hr: Translation<typeof en> = {
  labels: {
    ledgerRow: (fields) =>
      labelWords([dayInWords(fields.date), textOf(fields.counterparty) || textOf(fields.description), moneyInWords(fields.amount), labelled('saldo', moneyInWords(fields.balance))]),
    splitPart: (fields) => labelWords([textOf(fields.category), moneyInWords(fields.amount), dayInWords(fields.date)]),
    dismissal: (fields) => labelWords([textOf(fields.key), dayInWords(fields.dismissed_on)]),
    billingItem: (fields) => labelWords([textOf(fields.item), textOf(fields.client), dayInWords(fields.date), moneyInWords(fields.amount)]),
  },
  unlabelled: (slug) => SEEDED_NAMES.get(slug) ?? slugInWords(slug),
  swatches: { green: 'Zelena', orange: 'Narančasta', blue: 'Plava', amber: 'Jantarna', pink: 'Ružičasta', darkGreen: 'Tamnozelena', violet: 'Ljubičasta', red: 'Crvena', grey: 'Siva' },
  categories: {
    notAllFilled: 'category, family i bucket nisu svi popunjeni',
    notABucket: (bucket) => `„${bucket}” nije skupina`,
    unknownVat: (vat, slug) => `polje vat „${vat}” nije PDV tretman, pa se za „${slug}” čita kao „none”`,
    definedTwice: (slug) => `„${slug}” je definirana u više redaka, pa se nijedan ne broji`,
  },
  ledger: {
    noDate: 'polje date je prazno',
    notADateCell: (text) => `datum „${text}” nije ćelija s datumom`,
    noAccount: 'polje account je prazno',
    noAmount: (field) => `polje ${field} je prazno`,
    notANumber: (field, text) => `${field} „${text}” nije broj`,
  },
  splits: {
    noAccount: 'polje account je prazno',
    noRow: (account, date, amount, balance) => `u evidenciji nema ove stavke: ${croatianRow(account, date, amount, balance)}`,
    severalRows: (count, account, date, amount, balance) =>
      `${capitalised(croatianRow(account, date, amount, balance))} u evidenciji je ${count} ${plural({ one: 'put', few: 'puta', other: 'puta' }, count)}`,
    sharesKey: (account, date, amount, balance) => `${croatianRow(account, date, amount, balance)} dijeli ključ s drugom stavkom evidencije`,
    unreadableParts: (count) => ({
      one: `${count} dio ove podjele ne može se pročitati`,
      few: `${count} dijela ove podjele ne mogu se pročitati`,
      other: `${count} dijelova ove podjele ne može se pročitati`,
    }),
    onePart: 'podjela ima barem dva dijela, a ova ima jedan',
    partZero: (label) => `dio „${label}” iznosi nula`,
    partOtherSign: (label) => `dio „${label}” ima suprotan predznak od stavke`,
    partNoCategory: (label) => `dio „${label}” nema kategoriju`,
    partNotOnTab: (category, label) => `kategorija „${category}” dijela „${label}” nije među kategorijama`,
    partsAddUp: (total, row) => `dijelovi zajedno iznose ${formatMoney(total)}, a stavka ${formatMoney(row)}`,
    countsWhole: (reasons) => `${reasons}, pa se stavka evidencije broji cijela`,
    keptWhole: (account, date, why) => `stavka računa „${account}” od ${dayLabel(date)} ostaje cijela jer ${why}`,
    refusedKeptWhole: (account, date, amount, why) => `Stavka računa „${account}” od ${dayLabel(date)} na ${formatMoney(amount)} ostaje cijela jer ${why}.`,
  },
  accounts: {
    noName: 'polje account je prazno',
    otherCurrency: (slug, currency, workbook) => `„${slug}” je u valuti ${currency}, a datoteka broji u valuti ${workbook}, pa se njegovi iznosi čitaju kao ${workbook}`,
    namedTwice: (slug) => `„${slug}” je naveden u više redaka, pa se nijedan ne broji`,
  },
  dismissals: {
    noKey: 'polje key je prazno',
    dismissedTwice: (key) => `${key} je odbačen u više redaka, pa se nijedan ne broji`,
  },
  invoices: {
    noNumber: 'polje number je prazno',
    noClient: 'polje client je prazno',
    notANumber: (amount) => `iznos „${amount}” nije broj`,
    issuedNotADate: (issued) => `datum izdavanja „${issued}” nije ćelija s datumom`,
    dueNotADate: (due) => `dospijeće „${due}” nije ćelija s datumom`,
    listedTwice: (number, client) => `račun ${number} za „${client}” naveden je u više redaka, pa se nijedan ne broji`,
    clientMissing: (client, number) => `„${client}” nije u popisu klijenata, pa se s računom ${number} ne može povezati nijedna uplata`,
    periodUnread: (refused) => `${refused}, pa datum izdavanja vrijedi i za razdoblje isporuke`,
  },
  clients: {
    noName: 'polje client je prazno',
    noIban: 'polje iban je prazno',
    unknownLanguage: (tag) => `„${tag}” nije jezik poput „en” ili „hr”, pa se poruka piše na engleskom`,
    reverseCharge: (text) => `reverse_charge „${text}” nije ni TRUE ni FALSE, pa se čita kao FALSE`,
    onSeveralRows: (slug, rows) =>
      `„${slug}” je u ${rows} ${plural({ one: 'retku', few: 'retka', other: 'redaka' }, rows)}, pa se nijedan ne broji. Sve njegove IBAN-ove upišite u prvi redak, odvojene zarezima, a ostale retke obrišite`,
    sharedIban: (iban) => `${iban} je i kod drugog klijenta, pa se uplata s njega ne broji ni za jednog`,
  },
  billing: {
    noItem: 'polje item je prazno',
    noDate: 'polje date je prazno',
    noClient: 'polje client je prazno',
    clientMissing: (client) => `„${client}” nije u popisu klijenata`,
  },
  slugs: {
    needsName: (noun) => `${capitalised(SLUG_NOUNS[noun].one)} mora imati naziv`,
    notAName: (slug, noun) => `„${slug}” nije naziv ${SLUG_NOUNS[noun].of} koji aplikacija može koristiti: napišite ga malim slovima i znamenkama s pojedinačnim crticama, na primjer ai-services`,
    addedTwice: (slug) => `Naziv „${slug}” dodan je dvaput.`,
    already: (slug, noun) => `„${slug}” već postoji kao ${SLUG_NOUNS[noun].one}.`,
    inUse: (slug, deleted, users) => `„${slug}” ne može se ${deleted ? 'obrisati' : 'preimenovati'} jer je u upotrebi (${users}).`,
  },
}

export const words = language === 'hr' ? hr : en
