import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { capitalised } from '../../../../shared/text/capitalised'
import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A bank statement is izvod, a ledger row stavka and the ledger evidencija. Filing a statement writes its rows into the ledger, so it is upisati.

/** "1 stavka", "2 stavke", "5 stavki". */
function rowsCounted(count: number): string {
  return plural({ one: `${count} stavka`, few: `${count} stavke`, other: `${count} stavki` }, count)
}

/** "uvezena je 1 stavka", "uvezene su 2 stavke", "uvezeno je 5 stavki". */
function rowsImported(count: number): string {
  return plural({ one: `uvezena je ${count} stavka`, few: `uvezene su ${count} stavke`, other: `uvezeno je ${count} stavki` }, count)
}

export const en = {
  noRecipeAccount: (bank: string, currency: string) => `No account of ${bank} keeps ${currency}. Give the account the file is of the bank ${bank} on Settings, Accounts.`,
  twoRecipeAccounts: (bank: string, currency: string, accounts: readonly string[]) =>
    `${listInWords(accounts)} are both accounts of ${bank} in ${currency}, so the file could be either's. Give one of them another bank on Settings, Accounts.`,
  alreadyAnAccount: (name: string) => `${name} is already an account`,
  /** "Imported 4 rows", or "Added main and imported 4 rows" when the import adds accounts. */
  imported: (accounts: readonly string[], rows: number) => {
    const counted = rows === 1 ? '1 row' : `${rows} rows`
    return accounts.length === 0 ? `Imported ${counted}` : `Added ${accounts.join(' and ')} and imported ${counted}`
  },
  sync: {
    syncAgain: 'Not filed. Sync again.',
    heldKept: 'Kept the statements the sync holds until they are filed or passed over',
    /** "Filed statement 028, 4 rows", "Filed statements 028 and 029, 5 rows", or "Filed 3 statements, 9 rows". */
    filed: (numbers: readonly string[], rows: number) => {
      const which = numbers.length === 1 ? `statement ${numbers[0]}` : numbers.length === 2 ? `statements ${listInWords(numbers)}` : `${numbers.length} statements`
      return `Filed ${which}, ${rows === 1 ? '1 row' : `${rows} rows`}`
    },
  },
  ledger: {
    beforeNewest: (account: string, date: CivilDate, newest: CivilDate) => `A new ${account} row is dated ${dayLabel(date)}, before ${dayLabel(newest)}, the newest row of ${account} on the tab now.`,
    opensElsewhere: (account: string, opens: Money, leaves: Money) =>
      `The new ${account} rows open at ${formatMoney(opens)}, but the tab now leaves ${account} at ${formatMoney(leaves)}. Look at the dry run again.`,
    bookedAfter: (account: string, date: CivilDate, balance: Money) =>
      `The ${account} row of ${dayLabel(date)} with the balance ${formatMoney(balance)} is booked after the rows to take out, so its balance follows from them. Take it out first, or leave the rows.`,
    notACategory: (category: string) => `"${category}" is not a category on the categories tab.`,
    keepsRowId: (label: string) => `The ledger row "${label}" keeps the id it was given, since split parts and assets find it by that id.`,
    statementsFill: (account: string) => `${account} takes its rows from the bank's statements, so a sheet's or a copied row does not go on it.`,
  },
}

export const hr: Translation<typeof en> = {
  noRecipeAccount: (bank, currency) => `Nijedan račun banke ${bank} nije u valuti ${currency}. Računu ove datoteke upišite banku ${bank} u Postavkama, Računi u banci.`,
  twoRecipeAccounts: (bank, currency, accounts) =>
    `Računi ${listInWords(accounts.map((account) => `„${account}”`))} oba su u banci ${bank} i u valuti ${currency}, pa datoteka može biti bilo kojeg od njih. Jednom od njih upišite drugu banku u Postavkama, Računi u banci.`,
  alreadyAnAccount: (name) => `„${name}” već je račun u banci`,
  imported: (accounts, rows) => {
    if (accounts.length === 0) return capitalised(rowsImported(rows))
    const added = accounts.length === 1 ? `Dodan je račun „${accounts[0]}”` : `Dodani su računi ${listInWords(accounts.map((account) => `„${account}”`))}`
    return `${added} i ${rowsImported(rows)}`
  },
  sync: {
    syncAgain: 'Nije upisano. Sinkronizirajte ponovno.',
    heldKept: 'Zadržani izvodi čuvaju se dok se ne upišu ili preskoče',
    filed: (numbers, rows) => {
      const count = numbers.length
      const which =
        count === 1
          ? `Upisan je izvod ${numbers[0]}`
          : count === 2
            ? `Upisani su izvodi ${listInWords(numbers)}`
            : plural({ one: `Upisan je ${count} izvod`, few: `Upisana su ${count} izvoda`, other: `Upisano je ${count} izvoda` }, count)
      return `${which}, ${rowsCounted(rows)}`
    },
  },
  ledger: {
    beforeNewest: (account, date, newest) => `Nova stavka računa „${account}” ima datum ${dayLabel(date)}, prije ${dayLabel(newest)}, datuma najnovije stavke računa „${account}” u evidenciji.`,
    opensElsewhere: (account, opens, leaves) =>
      `Nove stavke računa „${account}” počinju od ${formatMoney(opens)}, a račun „${account}” u evidenciji sada završava saldom ${formatMoney(leaves)}. Ponovno pogledajte probni uvoz.`,
    bookedAfter: (account, date, balance) =>
      `Stavka računa „${account}” od ${dayLabel(date)} sa saldom ${formatMoney(balance)} proknjižena je nakon stavki koje se uklanjaju, pa njezin saldo ovisi o njima. Najprije uklonite nju ili ostavite stavke.`,
    notACategory: (category) => `„${category}” nije kategorija iz popisa kategorija.`,
    keepsRowId: (label) => `Stavka evidencije „${label}” zadržava ID koji je dobila jer je po njemu pronalaze dijelovi podjela i sredstva.`,
    statementsFill: (account) => `Račun „${account}” dobiva stavke iz izvoda banke, pa stavka tablice ili prepisanog izvoda ne ide na njega.`,
  },
}

export const words = language === 'hr' ? hr : en
