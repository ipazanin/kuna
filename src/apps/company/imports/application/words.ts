import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
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
  profileWithoutAccount: (profile: string, account: string) => `The profile ${profile || 'being made'} is for ${account || 'no account'}, which is not on the accounts tab. Pick one of its accounts.`,
  alreadyAnAccount: (name: string) => `${name} is already an account`,
  /** "Imported 4 rows", or "Added main and imported 4 rows" when the import adds accounts. */
  imported: (accounts: readonly string[], rows: number) => {
    const counted = rows === 1 ? '1 row' : `${rows} rows`
    return accounts.length === 0 ? `Imported ${counted}` : `Added ${accounts.join(' and ')} and imported ${counted}`
  },
  sync: {
    notCamt: (fileName: string) => `${fileName} is not a camt.053 statement, so it was not read.`,
    folderNotRead: (why: string) => `The statements folder could not be read: ${why}`,
    syncAgain: 'Not filed. Sync again.',
    /** "Filed statement 028, 4 rows", "Filed statements 028 and 029, 5 rows", or "Filed 3 statements, 9 rows". */
    filed: (numbers: readonly string[], rows: number) => {
      const which = numbers.length === 1 ? `statement ${numbers[0]}` : numbers.length === 2 ? `statements ${listInWords(numbers)}` : `${numbers.length} statements`
      return `Filed ${which}, ${rows === 1 ? '1 row' : `${rows} rows`}`
    },
  },
  ledger: {
    beforeNewest: (account: string, date: CivilDate, newest: CivilDate) => `A new ${account} row is dated ${date}, before ${newest}, the newest row of ${account} on the tab now.`,
    opensElsewhere: (account: string, opens: Money, leaves: Money) =>
      `The new ${account} rows open at ${plainAmount(opens)}, but the tab now leaves ${account} at ${plainAmount(leaves)}. Look at the dry run again.`,
    bookedAfter: (account: string, date: CivilDate, balance: Money) =>
      `The ${account} row of ${date} with the balance ${plainAmount(balance)} is booked after the rows to take out, so its balance follows from them. Take it out first, or leave the rows.`,
    notACategory: (category: string) => `"${category}" is not a category on the categories tab.`,
  },
}

export const hr: Translation<typeof en> = {
  profileWithoutAccount: (profile, account) => {
    const named = profile === '' ? 'Profil koji izrađujete' : `Profil ${profile}`
    return account === '' ? `${named} nema račun u banci. Odaberite jedan od računa iz postavki.` : `${named} odnosi se na račun ${account}, kojeg nema među računima u banci. Odaberite jedan od njih.`
  },
  alreadyAnAccount: (name) => `${name} već je račun u banci`,
  imported: (accounts, rows) => {
    if (accounts.length === 0) return capitalised(rowsImported(rows))
    const added = accounts.length === 1 ? `Dodan je račun ${accounts[0]}` : `Dodani su računi ${listInWords(accounts)}`
    return `${added} i ${rowsImported(rows)}`
  },
  sync: {
    notCamt: (fileName) => `${fileName} nije camt.053 izvod, pa nije pročitan.`,
    folderNotRead: (why) => `Mapa izvoda nije se mogla pročitati: ${why}`,
    syncAgain: 'Nije upisano. Sinkronizirajte ponovno.',
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
    beforeNewest: (account, date, newest) => `Nova stavka računa ${account} ima datum ${dayLabel(date)}, prije ${dayLabel(newest)}, datuma najnovije stavke računa ${account} u evidenciji.`,
    opensElsewhere: (account, opens, leaves) =>
      `Nove stavke računa ${account} počinju od ${formatMoney(opens)}, a račun ${account} u evidenciji sada završava saldom ${formatMoney(leaves)}. Ponovno pogledajte probni uvoz.`,
    bookedAfter: (account, date, balance) =>
      `Stavka računa ${account} od ${dayLabel(date)} sa saldom ${formatMoney(balance)} proknjižena je nakon stavki koje se uklanjaju, pa njezin saldo ovisi o njima. Najprije uklonite nju ili ostavite stavke.`,
    notACategory: (category) => `„${category}” nije kategorija iz popisa kategorija.`,
  },
}

export const words = language === 'hr' ? hr : en
