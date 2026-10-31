import { formatRate } from '../../../../../shared/money/moneyFormat'
import { language } from '../../../../../shared/text/language'
import { listInWords } from '../../../../../shared/text/listInWords'
import { plural } from '../../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../../shared/text/translation'
import { croatianBucket } from '../../../settings/domain/words'
import { dayText, labelWords, labelled, numberText } from '../../../../../shared/storage/domain/recordCodec'
import { textOf } from '../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../shared/storage/domain/storedFields'
import { dayInWords, moneyInWords } from '../../../workbook/domain/words'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A stored choice such as pd-nn, and TRUE and FALSE, stay as the settings tab writes them.

export const en = {
  /** The words that name a record of each kind, as its stored fields read. */
  labels: {
    scenarioRow: (fields: StoredFields) => labelWords([textOf(fields.scenario), textOf(fields.component), labelled('from', dayText(fields.from))]),
    ownerAdvance: (fields: StoredFields) => labelWords([textOf(fields.description), numberText(fields.amount), dayText(fields.date)]),
  },
  /** Why a company fact on the settings tab or in Settings, General cannot be used. */
  facts: {
    notADay: (value: string) => `"${value}" is not a date such as 2025-05-12`,
    neither: (value: string, choices: readonly string[]) => `"${value}" is neither ${choices.join(' nor ')}`,
    notARate: (value: string) => `"${value}" is not a rate such as 2%`,
    rateAboveOne: (number: number) => `${number} reads as ${number * 100}%. Enter the rate as a percentage cell, such as 2%`,
    rateRange: 'use a rate from 0% to 100% with at most two decimals, such as 2%',
  },
  /** How a refusal counts the pack's records that name a category, a grant or a scenario. */
  uses: {
    ownerAdvances: (count: number): EnglishForms => ({ one: `${count} owner advance`, other: `${count} owner advances` }),
    yearEndKontoRows: (count: number): EnglishForms => ({ one: `${count} year-end konto row`, other: `${count} year-end konto rows` }),
    planTabRows: (count: number): EnglishForms => ({ one: `${count} plan tab row`, other: `${count} plan tab rows` }),
    assets: (count: number): EnglishForms => ({ one: `${count} asset`, other: `${count} assets` }),
  },
  /** The accountant's kinds of mail as the Mail card lists them, and why an attachment of one is not filed. */
  accountantMail: {
    payroll: 'Payroll',
    vatReturns: 'VAT returns',
    invoices: "Accountant's invoices",
    notStartingWith: (phrase: string) => `The subject does not start with ${phrase}.`,
    noMonth: 'The subject names no month, such as 9/2026.',
    noPeriod: 'The subject names no period, such as 9/2026.',
    noEmployee: 'It names no one on the employees tab, and no single employee worked that month to file it for.',
    unknownOrder: 'It is a payment order of a kind the app does not know, so it is not filed under a guess.',
    orderWithoutPdf: 'No payment order PDF in the same mail says which order it carries.',
    notPayroll: 'It is not a payroll document the app knows how to name.',
    notVatReturn: "It is not the accountant's VAT return workbook.",
    notInvoice: "It is not the accountant's invoice PDF.",
  },
  /** Why a row of the pack's tabs cannot be read, as the problems card lists it. A field keeps its name as the tab stores it. */
  reading: {
    listedTwice: (key: string) => `"${key}" is listed on more than one row, so none of them counts`,
    keyListedTwice: (key: string) => `${key} is listed on more than one row, so none of them counts`,
    noGrantName: 'no grant name',
    fixedThenAssetsNeedsParts: 'a fixed-then-assets release needs fixed_part and variable_part',
    straightLineNeedsPeriod: 'a straight-line release needs period_from and period_to',
    partsGoTogether: 'fixed_part and variable_part go together, and only one is filled',
    partsNegative: 'fixed_part and variable_part cannot be negative',
    partsAddUp: (total: string, amount: string) => `fixed_part and variable_part add up to ${total}, not the amount ${amount}`,
    notWholeOrAmount: (name: string, text: string) => `${name} "${text}" is neither whole nor an amount above zero`,
    noDate: 'no date',
    notADateCell: (text: string) => `the date "${text}" is not a date cell`,
    noAmount: 'no amount',
    notANumber: (text: string) => `the amount "${text}" is not a number`,
    zero: 'the amount is zero',
    negativeAdvance: 'a negative amount is the owner’s private share of a company payment, which belongs on the splits tab. Press "Split" on its bank row on Transactions instead',
    noCategory: 'no category',
    notOnCategories: (slug: string) => `"${slug}" is not on the categories tab`,
    advanceBucket: (slug: string, bucket: string) => `"${slug}" is in the ${bucket} bucket, and an advance counts as an operating cost or a tax`,
    noAssetName: 'no asset name',
    before: (later: string, laterDay: string, earlier: string, earlierDay: string) => `${later} ${laterDay} is before ${earlier} ${earlierDay}`,
    notAFlag: (name: string, text: string) => `${name} "${text}" is neither TRUE nor FALSE`,
    noGrantOnTab: (grant: string) => `${grant} is not on the grants tab, so the asset's depreciation releases no grant`,
    noEmployeeName: 'no employee name',
    agreedGrossAboveZero: 'agreed_gross must be more than zero',
    notWholeBetween: (name: string, text: string, least: number, most: number) => `${name} "${text}" is not a whole number from ${least} to ${most}`,
    directorTwice: 'more than one row is marked director, so none of them counts. Mark one',
    noCity: 'no residence_city, which sets the income tax rates, so the payroll leaves this employee out',
    sharedIban: (iban: string) => `${iban} is on another employee too, so a payment to it counts for neither`,
    noScenarioName: 'no scenario name',
    outsideYear: (name: string, day: string, year: number) => `${name} ${day} is outside ${year}`,
    notAnItem: (item: string) => `"${item}" is not a tax-free item name, such as nontaxable:occasional-gift`,
    notAnAmountAboveZero: (text: string, alternative: string) => `amount "${text}" is not an amount above zero${alternative === '' ? '' : ` ${alternative}`}`,
    orFloor: 'or floor',
    orMax: 'or max',
    yearsOfScenario: (slug: string, years: readonly number[]) => `${slug} names the years ${years.join(' and ')}, and a scenario is for one year, so none of its rows counts`,
    sameComponent: (slug: string) => `${slug} has this component for the same days on more than one row, so none of them counts`,
    labelsDiffer: (slug: string) => `the rows of ${slug} give its label differently, so it reads blank`,
    noKonto: 'no konto number in line',
    noLine: 'no line',
    notALine: (line: string, statement: string) => `"${line}" is not a line of ${statement}`,
    amountNotANumber: (text: string) => `amount "${text}" is not a number`,
    amountNotADate: (text: string) => `amount "${text}" is not a date cell, and this line is a date`,
    amountNotARate: (text: string) => `amount "${text}" is not a rate`,
    rateAboveOne: (rate: number) => `amount ${rate} reads as ${rate * 100}%. Enter the rate as a percentage cell, such as 10%`,
    amountNotWhole: (text: string) => `amount "${text}" is not a whole number`,
    categoriesOnKontoOnly: 'categories is read on konto rows only, so it is ignored here',
    notOnCategoriesTab: (categories: readonly string[]) => `${categories.map((category) => `"${category}"`).join(', ')} ${categories.length === 1 ? 'is' : 'are'} not on the categories tab`,
    tie: (year: number, parts: string, computed: string, line: string, stated: string, apart: string) => `${year}: ${parts} ${computed}, but ${line} is ${stated}, ${apart} apart`,
    incomeLessExpenses: 'income less expenses is',
    assetLines: 'the asset lines add up to',
    equityAndLiabilities: 'equity and liabilities add up to',
  },
  /** Why a write to the pack's tabs is refused. */
  writes: {
    alreadyAScenario: (slug: string) => `"${slug}" is already a scenario. Pick another name.`,
    scenarioStopped: (scenario: string, reason: string) => `${scenario}: ${reason}`,
    planTab: (reason: string) => `The plan tab: ${reason}`,
  },
  /** The labels and reasons of the salaries set against the bank. */
  salaries: {
    paidToNoEmployee: 'Paid to no employee on the employees tab',
    noAgreedGross: 'the employees tab names no agreed_gross for an employee who is not the director',
    noCity: 'the employees tab names no residence_city',
    notEmployed: (month: string) => `the employment does not reach into ${month}`,
    paidTo: (name: string) => `Paid to ${name}`,
    paidOn: 'Paid on',
    payees: {
      pensionPillarOne: 'Paid to the state budget, pension pillar I',
      pensionPillarTwo: 'Paid to the pillar II account',
      health: 'Paid to the health insurance fund',
      incomeTax: 'Paid to the other payees, income tax',
    },
    sum: 'Sum',
  },
  /** Why the register keeps a row whole, as `the assets "Desk" and "Lamp" claim it as payment`. */
  assetsClaiming: (names: readonly string[]) => {
    const quoted = listInWords(names.map((name) => `"${name}"`))
    return names.length === 1 ? `the asset ${quoted} claims it as payment` : `the assets ${quoted} claim it as payment`
  },
  /** The labels of what the owner's benefits and loans would cost or save. */
  owner: {
    inYear: (name: string, year: number) => `${name} in ${year}`,
    taxAvoidedIn: (year: number) => `Tax avoided in ${year}`,
    asDividendIn: (year: number) => `As a dividend in ${year}`,
    taxAvoided: 'Tax avoided against a dividend',
    asDividend: 'As a dividend, net',
    daysOwed: (days: number, year: number) => `${days} ${days === 1 ? 'day' : 'days'} owed in ${year} on the loan of`,
    loanBenefit: (year: number) => `Benefit in kind on the owner's loans in ${year}`,
    noTaxLoss: 'Not worked out: the company has no tax loss',
    relatedPartyNone: 'Interest on the owner loans at the related-party rate, none charged',
    relatedPartyLess: (rate: string) => `Interest on the owner loans at the related-party rate, less the ${rate} they carry`,
    profitBeforeTax: 'Profit before tax',
    profitAfterTaxes: 'Profit after corporate and dividend tax',
  },
}

export const hr: Translation<typeof en> = {
  labels: {
    scenarioRow: (fields) => labelWords([textOf(fields.scenario), textOf(fields.component), labelled('od', dayInWords(fields.from))]),
    ownerAdvance: (fields) => labelWords([textOf(fields.description), moneyInWords(fields.amount), dayInWords(fields.date)]),
  },
  facts: {
    notADay: (value) => `„${value}” nije datum poput 2025-05-12`,
    neither: (value, choices) => `„${value}” nije ni ${choices.join(' ni ')}`,
    notARate: (value) => `„${value}” nije stopa poput 2 %`,
    rateAboveOne: (number) => `${number} se čita kao ${formatRate(number)}. Upišite stopu kao postotnu ćeliju, na primjer 2 %`,
    rateRange: 'upišite stopu od 0 % do 100 % s najviše dvije decimale, na primjer 2 %',
  },
  uses: {
    ownerAdvances: (count) => ({ one: `${count} predujam vlasnika`, few: `${count} predujma vlasnika`, other: `${count} predujmova vlasnika` }),
    yearEndKontoRows: (count) => ({ one: `${count} konto stavka zaključka godine`, few: `${count} konto stavke zaključka godine`, other: `${count} konto stavki zaključka godine` }),
    planTabRows: (count) => ({ one: `${count} stavka plana`, few: `${count} stavke plana`, other: `${count} stavki plana` }),
    assets: (count) => ({ one: `${count} sredstvo`, few: `${count} sredstva`, other: `${count} sredstava` }),
  },
  accountantMail: {
    payroll: 'Plaće',
    vatReturns: 'Prijave PDV-a',
    invoices: 'Računi knjigovođe',
    notStartingWith: (phrase) => `Predmet ne počinje s ${phrase}.`,
    noMonth: 'Predmet ne navodi mjesec, na primjer 9/2026.',
    noPeriod: 'Predmet ne navodi razdoblje, na primjer 9/2026.',
    noEmployee: 'Ne navodi nikoga s lista „employees”, a taj mjesec nije radio samo jedan zaposlenik za kojeg bi se spremio.',
    unknownOrder: 'To je platni nalog vrste koju aplikacija ne poznaje, pa se ne sprema nagađanjem.',
    orderWithoutPdf: 'Nijedan PDF platnog naloga u istoj poruci ne kaže koji nalog nosi.',
    notPayroll: 'To nije dokument o plaćama koji aplikacija zna nazvati.',
    notVatReturn: 'To nije datoteka s prijavom PDV-a koju šalje knjigovođa.',
    notInvoice: 'To nije PDF računa koji šalje knjigovođa.',
  },
  reading: {
    listedTwice: (key) => `„${key}” naveden je u više redaka, pa se nijedan ne broji`,
    keyListedTwice: (key) => `${key} naveden je u više redaka, pa se nijedan ne broji`,
    noGrantName: 'potpora nema naziv',
    fixedThenAssetsNeedsParts: 'priznavanje fixed-then-assets treba polja fixed_part i variable_part',
    straightLineNeedsPeriod: 'priznavanje straight-line treba polja period_from i period_to',
    partsGoTogether: 'fixed_part i variable_part idu zajedno, a popunjeno je samo jedno',
    partsNegative: 'fixed_part i variable_part ne mogu biti negativni',
    partsAddUp: (total, amount) => `fixed_part i variable_part zajedno daju ${total}, a ne iznos ${amount}`,
    notWholeOrAmount: (name, text) => `${name} „${text}” nije ni „whole” ni iznos veći od nule`,
    noDate: 'polje date je prazno',
    notADateCell: (text) => `datum „${text}” nije ćelija s datumom`,
    noAmount: 'polje amount je prazno',
    notANumber: (text) => `iznos „${text}” nije broj`,
    zero: 'iznos je nula',
    negativeAdvance: 'negativan iznos je vlasnikov privatni dio plaćanja tvrtke, koji pripada na list „splits”. Umjesto toga u Transakcijama na njegovoj bankovnoj stavci pritisnite „Podijeli”',
    noCategory: 'polje category je prazno',
    notOnCategories: (slug) => `„${slug}” nije na listu „categories”`,
    advanceBucket: (slug, bucket) => `„${slug}” je u skupini ${croatianBucket(bucket)}, a predujam se broji kao poslovni rashod ili porez`,
    noAssetName: 'sredstvo nema naziv',
    before: (later, laterDay, earlier, earlierDay) => `${later} ${laterDay} je prije ${earlier} ${earlierDay}`,
    notAFlag: (name, text) => `${name} „${text}” nije ni TRUE ni FALSE`,
    noGrantOnTab: (grant) => `„${grant}” nije na listu „grants”, pa amortizacija sredstva ne priznaje nikakvu potporu`,
    noEmployeeName: 'zaposlenik nema naziv',
    agreedGrossAboveZero: 'agreed_gross mora biti veći od nule',
    notWholeBetween: (name, text, least, most) => `${name} „${text}” nije cijeli broj od ${least} do ${most}`,
    directorTwice: 'kao direktor označeno je više redaka, pa se nijedan ne broji. Označite jedan',
    noCity: 'polje residence_city je prazno, a ono određuje stope poreza na dohodak, pa obračun plaće izostavlja ovog zaposlenika',
    sharedIban: (iban) => `${iban} je i kod drugog zaposlenika, pa se isplata na njega ne broji ni za jednog`,
    noScenarioName: 'scenarij nema naziv',
    outsideYear: (name, day, year) => `${name} ${day} je izvan ${year}.`,
    notAnItem: (item) => `„${item}” nije naziv neoporezivog primitka, poput nontaxable:occasional-gift`,
    notAnAmountAboveZero: (text, alternative) => `amount „${text}” nije iznos veći od nule${alternative === '' ? '' : ` ${alternative}`}`,
    orFloor: 'ni „floor”',
    orMax: 'ni „max”',
    yearsOfScenario: (slug, years) => `„${slug}” navodi godine ${years.join(' i ')}, a scenarij je za jednu godinu, pa se nijedan njegov redak ne broji`,
    sameComponent: (slug) => `„${slug}” ima ovu sastavnicu za iste dane u više redaka, pa se nijedan ne broji`,
    labelsDiffer: (slug) => `retci scenarija „${slug}” navode različite nazive, pa se naziv čita kao prazan`,
    noKonto: 'polje line ne navodi broj konta',
    noLine: 'polje line je prazno',
    notALine: (line, statement) => `„${line}” nije pozicija izvještaja ${statement}`,
    amountNotANumber: (text) => `amount „${text}” nije broj`,
    amountNotADate: (text) => `amount „${text}” nije ćelija s datumom, a ova je pozicija datum`,
    amountNotARate: (text) => `amount „${text}” nije stopa`,
    rateAboveOne: (rate) => `amount ${rate} čita se kao ${formatRate(rate)}. Upišite stopu kao postotnu ćeliju, na primjer 10 %`,
    amountNotWhole: (text) => `amount „${text}” nije cijeli broj`,
    categoriesOnKontoOnly: 'polje categories čita se samo u retcima konta, pa se ovdje zanemaruje',
    notOnCategoriesTab: (categories) => `${categories.map((category) => `„${category}”`).join(', ')} ${categories.length === 1 ? 'nije' : 'nisu'} na listu „categories”`,
    tie: (year, parts, computed, line, stated, apart) => `${year}.: ${parts} ${computed}, a ${line} iznosi ${stated}, razlika ${apart}`,
    incomeLessExpenses: 'prihodi umanjeni za rashode iznose',
    assetLines: 'pozicije aktive zajedno iznose',
    equityAndLiabilities: 'kapital i obveze zajedno iznose',
  },
  writes: {
    alreadyAScenario: (slug) => `„${slug}” već je scenarij. Odaberite drugi naziv.`,
    scenarioStopped: (scenario, reason) => `${scenario}: ${reason}`,
    planTab: (reason) => `List „plan”: ${reason}`,
  },
  salaries: {
    paidToNoEmployee: 'Isplaćeno nikome s lista „employees”',
    noAgreedGross: 'list „employees” ne navodi agreed_gross za zaposlenika koji nije direktor',
    noCity: 'list „employees” ne navodi residence_city',
    notEmployed: (month) => `zaposlenje ne seže u ${month}`,
    paidTo: (name) => `Isplaćeno: ${name}`,
    paidOn: 'Isplaćeno',
    payees: {
      pensionPillarOne: 'Uplaćeno u državni proračun, I. mirovinski stup',
      pensionPillarTwo: 'Uplaćeno na račun II. stupa',
      health: 'Uplaćeno zavodu za zdravstveno osiguranje',
      incomeTax: 'Uplaćeno ostalim primateljima, porez na dohodak',
    },
    sum: 'Zbroj',
  },
  assetsClaiming: (names) => {
    const quoted = listInWords(names.map((name) => `„${name}”`))
    return names.length === 1 ? `sredstvo ${quoted} vodi je kao plaćanje` : `sredstva ${quoted} vode je kao plaćanje`
  },
  owner: {
    inYear: (name, year) => `${name}, ${year}.`,
    taxAvoidedIn: (year) => `Ušteda na porezu u ${year}.`,
    asDividendIn: (year) => `Kao dividenda u ${year}.`,
    taxAvoided: 'Ušteda na porezu u odnosu na dividendu',
    asDividend: 'Kao dividenda, neto',
    daysOwed: (days, year) => `${days} ${plural({ one: 'dan', few: 'dana', other: 'dana' }, days)} duga u ${year}. na pozajmicu od`,
    loanBenefit: (year) => `Primitak u naravi na pozajmice vlasnika u ${year}.`,
    noTaxLoss: 'Nije izračunato: društvo nema porezni gubitak',
    relatedPartyNone: 'Kamata na pozajmice vlasnika po stopi za povezane osobe, nije obračunata',
    relatedPartyLess: (rate) => `Kamata na pozajmice vlasnika po stopi za povezane osobe, umanjena za ${rate} koje nose`,
    profitBeforeTax: 'Dobit prije oporezivanja',
    profitAfterTaxes: 'Dobit nakon poreza na dobit i poreza na dividendu',
  },
}

export const words = language === 'hr' ? hr : en
