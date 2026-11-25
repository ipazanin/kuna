import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { EntrySide } from '../../rules/domain/rule'
import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bank statement is izvod, its entries and the ledger's rows stavke, a row of the bank's own file redak, and the ledger evidencija.
// camt element names, setting words such as date_format and the statement's own label stay as the file writes them.

/** The side of a statement's entries a summary counts, in Croatian. */
const CROATIAN_SIDES: Readonly<Record<EntrySide, string>> = { debit: 'terećenja', credit: 'odobrenja' }

/** "1 stavku", "2 stavke", "5 stavki", as a count of entries reads after a verb. */
function entriesCounted(count: number): string {
  return plural({ one: `${count} stavku`, few: `${count} stavke`, other: `${count} stavki` }, count)
}

export const en = {
  camt: {
    notCamt: (fileName: string) => `${fileName} is not a camt.053 statement: it carries no BkToCstmrStmt/Stmt element.`,
    /** What a statement that carries no label of its own is called. */
    unnamed: (position: number, fileName: string) => `statement ${position} of ${fileName}`,
    noLabel: 'The statement carries no CreDtTm or no LglSeqNb, so it cannot be named.',
    noIban: 'The statement names no Acct/Id/IBAN, so the app cannot tell whose account it is.',
    noCurrency: 'The statement states no Acct/Ccy, so no entry can be checked against it.',
    chainOpen: (opening: Money, credits: Money, debits: Money, expected: Money, closing: Money) =>
      `The balance chain does not close: opening ${formatMoney(opening)} plus credits ${formatMoney(credits)} less debits ${formatMoney(debits)} is ${formatMoney(expected)}, but CLBD reports ${formatMoney(closing)}.`,
    summaryRequired: 'The statement carries no TxsSummry, which this bank always sends, so its entries cannot be counted against the totals the bank reports.',
    noSummary: 'The statement carries no TxsSummry, so its entries are checked against its balances only, not against counts and totals from the bank.',
    notBooked: (count: number) =>
      plural(
        {
          one: `${count} entry the bank has not booked yet, such as a pending one, is left out, since it has not moved the balance.`,
          other: `${count} entries the bank has not booked yet, such as pending ones, are left out, since they have not moved the balance.`,
        },
        count,
      ),
    noBalance: (code: string) => `The statement carries no ${code} balance, so its chain cannot be closed.`,
    balanceCurrency: (code: string, balanceCurrency: string, currency: string) => `The ${code} balance is in "${balanceCurrency}" but the account is in ${currency}.`,
    /** What an amount the reader could not read is, as a refusal names it. */
    balanceAmount: (code: string) => `the ${code} balance`,
    entryAmount: (entry: string) => `the amount on entry ${entry}`,
    noReference: '(no reference)',
    badIndicator: (entry: string, indicator: string) => `Entry ${entry} carries CdtDbtInd "${indicator}", which is neither CRDT nor DBIT.`,
    noAmount: (entry: string) => `Entry ${entry} carries no Amt.`,
    entryCurrency: (entry: string, entryCurrency: string, currency: string) => `Entry ${entry} is in ${entryCurrency || 'no currency'} but the account is in ${currency}.`,
    noDate: (entry: string) => `Entry ${entry} carries neither a booking nor a value date.`,
    notADay: (element: string, text: string) => `An entry's ${element} is "${text}", which is not a day.`,
    summaryCount: (element: string, declared: number, read: number, side: EntrySide) => `${element} reports ${declared} entries but ${read} booked ${side} entries were read.`,
    summarySum: (element: string, declared: Money, summed: Money, side: EntrySide) => `${element} reports ${formatMoney(declared)} but the booked ${side} entries sum to ${formatMoney(summed)}.`,
    notANumber: (what: string, text: string) => `${capitalised(what)} is "${text}", which is not a number.`,
    signed: (what: string, text: string) => `${capitalised(what)} is "${text}", but a camt amount is unsigned and its direction is carried by the CdtDbtInd beside it.`,
    finerThanACent: (what: string, text: string) => `${capitalised(what)} is "${text}", which is finer than a cent.`,
    /** Why the import asks for a row to be checked, as the screens name the reason the ledger stores. */
    reviewReasons: { noReference: 'no bank reference', reversal: 'reversal', valueDate: 'value date used', batched: 'batched entry' },
  },
  table: {
    noHeader: (searched: number, fileName: string, recipe: string, columns: readonly string[]) =>
      `No row in the first ${searched} of ${fileName} carries every column of the recipe ${recipe}: ${columns.map((column) => `"${column}"`).join(', ')}.`,
    noDate: (row: number) => `Row ${row} has no date, so it is skipped.`,
    labelForDate: (row: number, text: string) => `Row ${row} reads "${text}" where the date goes, so it is skipped.`,
    notADate: (row: number, text: string, format: string) => `row ${row}: "${text}" is not a date written as ${format}`,
    rowProblem: (row: number, problem: string) => `row ${row}: ${problem}`,
    balanceNotAmount: (row: number, text: string) => `row ${row}: the balance "${text}" is not an amount`,
    unreadable: (fileName: string, recipe: string, problems: readonly string[], more: number) =>
      `${fileName} has rows the recipe ${recipe} cannot read, so nothing of it is imported: ${problems.join('; ')}${more > 0 ? `, and ${more} more` : ''}.`,
    noKind: (row: number) => `row ${row}: no kind of the recipe takes it`,
    leftOut: (count: number) => plural({ one: `The recipe leaves ${count} row out.`, other: `The recipe leaves ${count} rows out.` }, count),
    noRows: (fileName: string) => `${fileName} holds no rows with a date under the header row.`,
    noAmount: 'no amount',
    amountNotAmount: (text: string) => `the amount "${text}" is not an amount`,
    notAnAmount: (text: string) => `"${text}" is not an amount`,
    bothColumns: 'both the debit and the credit column hold an amount',
    neitherColumn: 'no amount in the debit or the credit column',
    zero: 'an amount of zero',
    negativeCredit: (text: string) => `the credit "${text}" is negative, so whether the money came in or went out is unclear`,
    unordered: (fileName: string) => `The dates in ${fileName} run neither oldest first nor newest first, so the rows cannot be put in booking order.`,
    balanceBreak: (row: number, balance: Money, previousRow: number, previous: Money, amount: Money, expected: Money) =>
      `Row ${row} says the balance is ${formatMoney(balance)}, but row ${previousRow}'s ${formatMoney(previous)} plus ${formatMoney(amount)} is ${formatMoney(expected)}. The rows may be out of order or one may be missing.`,
  },
  profile: {
    badName: 'a profile name is lower-case letters and digits with single hyphens, such as otp-business',
    notAPair: (part: string) => `"${part}" is not a word=column pair the profile knows`,
    givenTwice: (word: string) => `${word} is given twice`,
    namesNo: (missing: readonly string[]) => `the profile names no ${missing.join(' and no ')}`,
    badDateFormat: (format: string, formats: readonly string[]) => `date_format "${format}" is not one of ${formats.join(', ')}`,
    badDecimal: (decimal: string) => `decimal "${decimal}" is neither comma nor point`,
    amountColumns: 'the profile needs either amount, or both debit and credit',
  },
}

export const hr: Translation<typeof en> = {
  camt: {
    notCamt: (fileName) => `„${fileName}” nije camt.053 izvod jer nema element BkToCstmrStmt/Stmt.`,
    unnamed: (position, fileName) => `izvod ${position} u datoteci „${fileName}”`,
    noLabel: 'Izvod nema CreDtTm ili LglSeqNb, pa mu se ne može dati naziv.',
    noIban: 'Izvod ne navodi Acct/Id/IBAN, pa aplikacija ne zna čiji je to račun.',
    noCurrency: 'Izvod ne navodi Acct/Ccy, pa se nijedna stavka ne može provjeriti prema valuti računa.',
    chainOpen: (opening, credits, debits, expected, closing) =>
      `Salda se ne zatvaraju: početno stanje ${formatMoney(opening)} plus odobrenja ${formatMoney(credits)} minus terećenja ${formatMoney(debits)} iznosi ${formatMoney(expected)}, a CLBD navodi ${formatMoney(closing)}.`,
    summaryRequired: 'Izvod nema TxsSummry, koji ova banka uvijek šalje, pa se stavke ne mogu usporediti sa zbrojevima koje banka navodi.',
    noSummary: 'Izvod nema TxsSummry, pa se stavke provjeravaju samo prema saldima, a ne prema broju stavki i zbrojevima banke.',
    notBooked: (count) => `Stavke koje banka još nije proknjižila, primjerice one na čekanju, nisu uvezene jer nisu promijenile saldo: ${count}.`,
    noBalance: (code) => `Izvod nema saldo ${code}, pa se salda ne mogu zatvoriti.`,
    balanceCurrency: (code, balanceCurrency, currency) => `Saldo ${code} je u valuti „${balanceCurrency}”, a račun se vodi u valuti ${currency}.`,
    balanceAmount: (code) => `saldo ${code}`,
    entryAmount: (entry) => `iznos stavke ${entry}`,
    noReference: '(bez reference)',
    badIndicator: (entry, indicator) => `Stavka ${entry} ima CdtDbtInd „${indicator}”, a to nije ni CRDT ni DBIT.`,
    noAmount: (entry) => `Stavka ${entry} nema Amt.`,
    entryCurrency: (entry, entryCurrency, currency) => `Stavka ${entry} ${entryCurrency === '' ? 'nema valutu' : `je u valuti ${entryCurrency}`}, a račun se vodi u valuti ${currency}.`,
    noDate: (entry) => `Stavka ${entry} nema ni datum knjiženja ni datum valute.`,
    notADay: (element, text) => `${element} jedne stavke je „${text}”, a to nije datum.`,
    summaryCount: (element, declared, read, side) => `${element} navodi ${entriesCounted(declared)}, a aplikacija je pročitala ${entriesCounted(read)} proknjiženih ${CROATIAN_SIDES[side]}.`,
    summarySum: (element, declared, summed, side) => `${element} navodi ${formatMoney(declared)}, a proknjižene stavke ${CROATIAN_SIDES[side]} zbrajaju se na ${formatMoney(summed)}.`,
    notANumber: (what, text) => `${capitalised(what)} je „${text}”, a to nije broj.`,
    signed: (what, text) => `${capitalised(what)} je „${text}”, a iznos u camt datoteci nema predznak jer smjer nosi CdtDbtInd uz njega.`,
    finerThanACent: (what, text) => `${capitalised(what)} je „${text}”, a to ima više od dvije decimale.`,
    reviewReasons: { noReference: 'nema bankovne reference', reversal: 'storno', valueDate: 'korišten datum valute', batched: 'skupna stavka' },
  },
  table: {
    noHeader: (searched, fileName, recipe, columns) =>
      `Nijedan od prvih ${searched} redaka datoteke „${fileName}” nema sve stupce recepta „${recipe}”: ${columns.map((column) => `„${column}”`).join(', ')}.`,
    noDate: (row) => `Redak ${row} nema datum, pa se preskače.`,
    labelForDate: (row, text) => `U retku ${row} umjesto datuma piše „${text}”, pa se preskače.`,
    notADate: (row, text, format) => `redak ${row}: „${text}” nije datum zapisan kao ${format}`,
    rowProblem: (row, problem) => `redak ${row}: ${problem}`,
    balanceNotAmount: (row, text) => `redak ${row}: saldo „${text}” nije iznos`,
    unreadable: (fileName, recipe, problems, more) =>
      `Datoteka „${fileName}” ima retke koje recept „${recipe}” ne može pročitati, pa se ništa iz nje ne uvozi: ${problems.join('; ')}${more > 0 ? ` i još ${more}` : ''}.`,
    noKind: (row) => `redak ${row}: nijedna vrsta recepta ga ne uzima`,
    leftOut: (count) => plural({ one: `Recept izostavlja ${count} redak.`, few: `Recept izostavlja ${count} retka.`, other: `Recept izostavlja ${count} redaka.` }, count),
    noRows: (fileName) => `Datoteka „${fileName}” nema redaka s datumom ispod retka zaglavlja.`,
    noAmount: 'nema iznosa',
    amountNotAmount: (text) => `„${text}” u stupcu iznosa nije iznos`,
    notAnAmount: (text) => `„${text}” nije iznos`,
    bothColumns: 'i stupac terećenja i stupac odobrenja imaju iznos',
    neitherColumn: 'nema iznosa ni u stupcu terećenja ni u stupcu odobrenja',
    zero: 'iznos je nula',
    negativeCredit: (text) => `odobrenje „${text}” je negativno, pa nije jasno je li novac uplaćen ili isplaćen`,
    unordered: (fileName) => `Datumi u datoteci „${fileName}” nisu poredani ni od najstarijeg ni od najnovijeg, pa se retci ne mogu poredati po redu knjiženja.`,
    balanceBreak: (row, balance, previousRow, previous, amount, expected) =>
      `Redak ${row} navodi saldo ${formatMoney(balance)}, ali ${formatMoney(previous)} iz retka ${previousRow} plus ${formatMoney(amount)} iznosi ${formatMoney(expected)}. Retci možda nisu po redu ili neki nedostaje.`,
  },
  profile: {
    badName: 'naziv profila piše se malim slovima i znamenkama s pojedinačnim crticama, na primjer otp-business',
    notAPair: (part) => `„${part}” nije par riječ=stupac koji profil poznaje`,
    givenTwice: (word) => `${word} je naveden dvaput`,
    namesNo: (missing) => `profil ne navodi ${missing.join(' ni ')}`,
    badDateFormat: (format, formats) => `date_format „${format}” nije nijedan od ovih: ${formats.join(', ')}`,
    badDecimal: (decimal) => `polje decimal „${decimal}” nije ni „comma” ni „point”`,
    amountColumns: 'profil treba ili polje amount, ili polja debit i credit',
  },
}

export const words = language === 'hr' ? hr : en
