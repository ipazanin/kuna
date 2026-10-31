import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bank statement is izvod, its entries and the ledger's rows stavke, a row of the bank's own file redak, and the ledger evidencija.
// camt element names, setting words such as date_format and the statement's own label stay as the file writes them.

/** The side of a statement's entries a summary counts. */
export type EntrySide = 'debit' | 'credit'

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
      `The balance chain does not close: opening ${plainAmount(opening)} plus credits ${plainAmount(credits)} less debits ${plainAmount(debits)} is ${plainAmount(expected)}, but CLBD reports ${plainAmount(closing)}.`,
    summaryRequired: 'The statement carries no TxsSummry, which this bank always sends, so its entries cannot be counted against the totals the bank reports.',
    noSummary: 'The statement carries no TxsSummry, so its entries are checked against its balances only, not against counts and totals from the bank.',
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
    summarySum: (element: string, declared: Money, summed: Money, side: EntrySide) => `${element} reports ${plainAmount(declared)} but the booked ${side} entries sum to ${plainAmount(summed)}.`,
    notANumber: (what: string, text: string) => `${capitalised(what)} is "${text}", which is not a number.`,
    signed: (what: string, text: string) => `${capitalised(what)} is "${text}", but a camt amount is unsigned and its direction is carried by the CdtDbtInd beside it.`,
    finerThanACent: (what: string, text: string) => `${capitalised(what)} is "${text}", which is finer than a cent.`,
    /** Why the import asks for a row to be checked, as the screens name the reason the ledger stores. */
    reviewReasons: { noReference: 'no bank reference', reversal: 'reversal', valueDate: 'value date used', batched: 'batched entry' },
  },
  table: {
    noHeader: (searched: number, fileName: string, profile: string, columns: readonly string[]) =>
      `No row in the first ${searched} of ${fileName} carries every column of the profile ${profile}: ${columns.map((column) => `"${column}"`).join(', ')}.`,
    noDate: (row: number) => `Row ${row} has no date, so it is skipped.`,
    labelForDate: (row: number, text: string) => `Row ${row} reads "${text}" where the date goes, so it is skipped.`,
    notADate: (row: number, text: string, format: string) => `row ${row}: "${text}" is not a ${format} date`,
    rowProblem: (row: number, problem: string) => `row ${row}: ${problem}`,
    balanceNotAmount: (row: number, text: string) => `row ${row}: the balance "${text}" is not an amount`,
    unreadable: (fileName: string, profile: string, problems: readonly string[], more: number) =>
      `${fileName} has rows the profile ${profile} cannot read, so nothing of it is imported: ${problems.join('; ')}${more > 0 ? `, and ${more} more` : ''}.`,
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
      `Row ${row} says the balance is ${plainAmount(balance)}, but row ${previousRow}'s ${plainAmount(previous)} plus ${plainAmount(amount)} is ${plainAmount(expected)}. The rows may be out of order or one may be missing.`,
  },
  dryRun: {
    noEntries: 'The statement has no booked entries, so importing it writes nothing.',
    allHeld: 'Every entry is on the ledger already, so importing it writes nothing.',
    importedBefore: (label: string, noneMatch: boolean) =>
      `Rows of ${label} are on the ledger already, so this file was imported before, and ${noneMatch ? 'none' : 'only some'} of its entries match them now, such as after a change to its profile. Nothing of it is written.`,
    gap: 'Rows the ledger lacks sit between rows it already holds, so the statement does not continue where the ledger leaves the account. Nothing of it is written.',
    partlyHeld: (held: number, total: number, fresh: number) => `${held} of its ${total} entries are on the ledger already. The other ${fresh} follow them.`,
    noReference: (count: number) =>
      `${count === 1 ? 'An entry carries' : `${count} entries carry`} no bank reference, so a second import could not tell ${count === 1 ? 'it' : 'them'} from others. The whole statement is refused.`,
    beforeNewest: (first: CivilDate, newest: CivilDate, account: string) =>
      `Its first new entry is dated ${first}, before ${newest}, the newest row of ${account}. Rows are only added after the newest one.`,
    missingBetween: (account: string, balance: Money, day: CivilDate, before: Money) =>
      `The ledger ends ${account} at ${plainAmount(balance)} on ${day}, but this statement's first new entry starts from ${plainAmount(before)}, so a statement between the two is missing. Import that one first.`,
    worksOutBalances: (opening: Money, account: string, day: CivilDate) =>
      `The file gives no balances, so they are worked out from ${plainAmount(opening)}, where the ledger leaves ${account} on ${day}.`,
    sequenceGap: (sequence: number, newest: number, account: string, missing: number) =>
      `It is statement ${sequence}, and the newest on the ledger for ${account} is ${newest}, so ${missing === 1 ? 'one statement is' : `${missing} statements are`} not on the ledger. The balances still join, so ${missing === 1 ? 'it' : 'they'} may have held no entries.`,
    sequenceNotAfter: (sequence: number, newest: number, account: string) => `It is statement ${sequence}, which is not after ${newest}, the newest on the ledger for ${account}.`,
    labelHeld: (label: string) => `Rows of ${label} are on the ledger already.`,
  },
  profile: {
    badName: 'a profile name is lower-case letters and digits with single hyphens, such as otp-business',
    notAPair: (part: string) => `"${part}" is not a word=column pair the profile knows`,
    givenTwice: (word: string) => `${word} is given twice`,
    namesNo: (missing: readonly string[]) => `the profile names no ${missing.join(' and no ')}`,
    badDateFormat: (format: string, formats: readonly string[]) => `date_format "${format}" is not one of ${formats.join(', ')}`,
    badDecimal: (decimal: string) => `decimal "${decimal}" is neither comma nor point`,
    amountColumns: 'the profile needs either amount, or both debit and credit',
    unsaveableColumn: (column: string) => `the column "${column}" holds ; or =, which a saved profile cannot hold`,
    draft: {
      name: 'Give the profile a name: lower-case letters and digits with single hyphens, such as otp-business.',
      account: 'Pick the account the export is for.',
      date: 'Pick the date column.',
      amount: 'Pick the amount columns.',
    },
  },
}

export const hr: Translation<typeof en> = {
  camt: {
    notCamt: (fileName) => `${fileName} nije camt.053 izvod jer nema element BkToCstmrStmt/Stmt.`,
    unnamed: (position, fileName) => `izvod ${position} u datoteci ${fileName}`,
    noLabel: 'Izvod nema CreDtTm ili LglSeqNb, pa mu se ne može dati naziv.',
    noIban: 'Izvod ne navodi Acct/Id/IBAN, pa aplikacija ne zna čiji je to račun.',
    noCurrency: 'Izvod ne navodi Acct/Ccy, pa se nijedna stavka ne može provjeriti prema valuti računa.',
    chainOpen: (opening, credits, debits, expected, closing) =>
      `Salda se ne zatvaraju: početno stanje ${formatMoney(opening)} plus odobrenja ${formatMoney(credits)} minus terećenja ${formatMoney(debits)} iznosi ${formatMoney(expected)}, a CLBD navodi ${formatMoney(closing)}.`,
    summaryRequired: 'Izvod nema TxsSummry, koji ova banka uvijek šalje, pa se stavke ne mogu usporediti sa zbrojevima koje banka navodi.',
    noSummary: 'Izvod nema TxsSummry, pa se stavke provjeravaju samo prema saldima, a ne prema broju stavki i zbrojevima banke.',
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
    noHeader: (searched, fileName, profile, columns) =>
      `Nijedan od prvih ${searched} redaka datoteke ${fileName} nema sve stupce profila ${profile}: ${columns.map((column) => `„${column}”`).join(', ')}.`,
    noDate: (row) => `Redak ${row} nema datum, pa se preskače.`,
    labelForDate: (row, text) => `U retku ${row} umjesto datuma piše „${text}”, pa se preskače.`,
    notADate: (row, text, format) => `redak ${row}: „${text}” nije datum oblika ${format}`,
    rowProblem: (row, problem) => `redak ${row}: ${problem}`,
    balanceNotAmount: (row, text) => `redak ${row}: saldo „${text}” nije iznos`,
    unreadable: (fileName, profile, problems, more) =>
      `Datoteka ${fileName} ima retke koje profil ${profile} ne može pročitati, pa se ništa iz nje ne uvozi: ${problems.join('; ')}${more > 0 ? ` i još ${more}` : ''}.`,
    noRows: (fileName) => `Datoteka ${fileName} nema redaka s datumom ispod retka zaglavlja.`,
    noAmount: 'nema iznosa',
    amountNotAmount: (text) => `„${text}” u stupcu iznosa nije iznos`,
    notAnAmount: (text) => `„${text}” nije iznos`,
    bothColumns: 'i stupac terećenja i stupac odobrenja imaju iznos',
    neitherColumn: 'nema iznosa ni u stupcu terećenja ni u stupcu odobrenja',
    zero: 'iznos je nula',
    negativeCredit: (text) => `odobrenje „${text}” je negativno, pa nije jasno je li novac uplaćen ili isplaćen`,
    unordered: (fileName) => `Datumi u datoteci ${fileName} nisu poredani ni od najstarijeg ni od najnovijeg, pa se retci ne mogu poredati po redu knjiženja.`,
    balanceBreak: (row, balance, previousRow, previous, amount, expected) =>
      `Redak ${row} navodi saldo ${formatMoney(balance)}, ali ${formatMoney(previous)} iz retka ${previousRow} plus ${formatMoney(amount)} iznosi ${formatMoney(expected)}. Retci možda nisu po redu ili neki nedostaje.`,
  },
  dryRun: {
    noEntries: 'Izvod nema proknjiženih stavki, pa njegov uvoz ništa ne upisuje.',
    allHeld: 'Sve su stavke već u evidenciji, pa uvoz ništa ne upisuje.',
    importedBefore: (label, noneMatch) =>
      `Stavke izvoda ${label} već su u evidenciji, pa je ova datoteka već uvezena, a ${noneMatch ? 'nijedna njezina stavka sada im ne odgovara' : 'samo im neke njezine stavke sada odgovaraju'}, na primjer nakon promjene profila. Ništa se iz nje ne upisuje.`,
    gap: 'Stavke kojih nema u evidenciji nalaze se između stavki koje već postoje, pa se izvod ne nastavlja na zadnju stavku računa u evidenciji. Ništa se iz njega ne upisuje.',
    partlyHeld: (held, total, fresh) => `Stavke izvoda već u evidenciji: ${held} od ${total}. Nove stavke (${fresh}) dolaze nakon njih.`,
    noReference: (count) =>
      plural(
        {
          one: `${count === 1 ? 'Jedna stavka' : `${count} stavka`} nema bankovnu referencu, pa je drugi uvoz ne bi mogao razlikovati od ostalih. Cijeli izvod je odbijen.`,
          few: `${count} stavke nemaju bankovnu referencu, pa ih drugi uvoz ne bi mogao razlikovati od ostalih. Cijeli izvod je odbijen.`,
          other: `${count} stavki nema bankovnu referencu, pa ih drugi uvoz ne bi mogao razlikovati od ostalih. Cijeli izvod je odbijen.`,
        },
        count,
      ),
    beforeNewest: (first, newest, account) =>
      `Prva nova stavka ima datum ${dayLabel(first)}, prije ${dayLabel(newest)}, datuma najnovije stavke računa ${account}. Stavke se dodaju samo nakon najnovije.`,
    missingBetween: (account, balance, day, before) =>
      `Račun ${account} u evidenciji završava saldom ${formatMoney(balance)} na dan ${dayLabel(day)}, a prva nova stavka ovog izvoda polazi od ${formatMoney(before)}, pa između njih nedostaje izvod. Najprije uvezite njega.`,
    worksOutBalances: (opening, account, day) => `Datoteka ne navodi salda, pa se izračunavaju od ${formatMoney(opening)}, salda računa ${account} u evidenciji na dan ${dayLabel(day)}.`,
    sequenceGap: (sequence, newest, account, missing) => {
      const gap = plural(
        {
          one: `${missing === 1 ? 'nedostaje jedan izvod' : `nedostaje ${missing} izvod`}. Salda se ipak nastavljaju, pa možda nije imao stavki.`,
          few: `nedostaju ${missing} izvoda. Salda se ipak nastavljaju, pa možda nisu imali stavki.`,
          other: `nedostaje ${missing} izvoda. Salda se ipak nastavljaju, pa možda nisu imali stavki.`,
        },
        missing,
      )
      return `To je izvod ${sequence}, a najnoviji u evidenciji za račun ${account} je ${newest}, pa u evidenciji ${gap}`
    },
    sequenceNotAfter: (sequence, newest, account) => `To je izvod ${sequence}, koji ne dolazi nakon izvoda ${newest}, najnovijeg u evidenciji za račun ${account}.`,
    labelHeld: (label) => `Stavke izvoda ${label} već su u evidenciji.`,
  },
  profile: {
    badName: 'naziv profila piše se malim slovima i znamenkama s pojedinačnim crticama, na primjer otp-business',
    notAPair: (part) => `„${part}” nije par riječ=stupac koji profil poznaje`,
    givenTwice: (word) => `${word} je naveden dvaput`,
    namesNo: (missing) => `profil ne navodi ${missing.join(' ni ')}`,
    badDateFormat: (format, formats) => `date_format „${format}” nije nijedan od ovih: ${formats.join(', ')}`,
    badDecimal: (decimal) => `decimal „${decimal}” nije ni comma ni point`,
    amountColumns: 'profil treba ili amount, ili i debit i credit',
    unsaveableColumn: (column) => `stupac „${column}” sadrži ; ili =, a spremljeni profil to ne može sadržavati`,
    draft: {
      name: 'Dajte profilu naziv: mala slova i znamenke s pojedinačnim crticama, na primjer otp-business.',
      account: 'Odaberite račun u banci na koji se izvoz odnosi.',
      date: 'Odaberite stupac datuma.',
      amount: 'Odaberite stupce iznosa.',
    },
  },
}

export const words = language === 'hr' ? hr : en
