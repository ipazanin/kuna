import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The books file is datoteka. A tab of the file is list, named as the file names it, such as ledger.

export const en = {
  exportToExcel: 'Export to Excel',
  exported: 'Exported',
  exportFailed: 'Export failed',
  dialog: {
    title: (fileName: string) => `Open ${fileName}`,
    titleWithoutFile: 'Open a file',
    description: 'Check what the file holds, then choose where to keep it. Nothing changes until you choose.',
    keptInBrowser: 'Kept in this browser',
    keptCount: (count: number, fileName: string) => `${count} transactions from ${fileName}`,
    replaces: 'This replaces the workbook kept in this browser',
    replacesDescription: 'Changes you made here since your last export are lost. Export first if you want to keep them.',
    redirectNote: 'Keep on Google Drive asks Google for access first. On this device that opens Google and comes back, and you open the file again then.',
    cancel: 'Cancel',
    keepInBrowser: 'Keep in this browser',
    keepOnDrive: 'Keep on Google Drive',
  },
  summary: {
    reading: 'Reading the file',
    transactions: 'Transactions',
    dates: 'Dates',
    noneYet: 'None yet',
    range: (from: string, to: string) => `${from} to ${to}`,
    account: 'Account',
    accounts: 'Accounts',
    categories: 'Categories',
    refusedHelp: 'Open an Excel download of the Google Sheet, a file the app exported, or a Kuna file from the backups folder.',
    records: (count: number): EnglishForms => ({ one: `${count} record, by tab`, other: `${count} records, by tab` }),
    /** "No settings, rules or clients tab, so they read as empty and the defaults apply." */
    defaulted: (tabs: readonly string[]) =>
      `No ${tabs.length <= 1 ? (tabs[0] ?? '') : `${tabs.slice(0, -1).join(', ')} or ${tabs[tabs.length - 1]}`} tab, so ${tabs.length === 1 ? 'it reads' : 'they read'} as empty and the defaults apply.`,
    problems: (count: number): EnglishForms => ({ one: `${count} row the app could not use as written`, other: `${count} rows the app could not use as written` }),
    clean: 'Every row reads cleanly.',
  },
}

export const hr: Translation<typeof en> = {
  exportToExcel: 'Izvezi u Excel',
  exported: 'Izvezeno',
  exportFailed: 'Izvoz nije uspio',
  dialog: {
    title: (fileName) => `Otvori ${fileName}`,
    titleWithoutFile: 'Otvori datoteku',
    description: 'Provjerite što datoteka sadrži, a zatim odaberite gdje će se čuvati. Ništa se ne mijenja dok ne odaberete.',
    keptInBrowser: 'Čuva se u ovom pregledniku',
    keptCount: (count, fileName) => `${plural({ one: `${count} transakcija`, few: `${count} transakcije`, other: `${count} transakcija` }, count)} iz datoteke ${fileName}`,
    replaces: 'Ovo zamjenjuje datoteku koja se čuva u ovom pregledniku',
    replacesDescription: 'Promjene koje ste ovdje napravili od zadnjeg izvoza bit će izgubljene. Najprije izvezite ako ih želite sačuvati.',
    redirectNote: '„Čuvaj na Google Driveu” najprije traži pristup od Googlea. Na ovom uređaju to otvara Google i vraća vas ovamo, a datoteku tada otvorite ponovno.',
    cancel: 'Odustani',
    keepInBrowser: 'Čuvaj u ovom pregledniku',
    keepOnDrive: 'Čuvaj na Google Driveu',
  },
  summary: {
    reading: 'Čitanje datoteke',
    transactions: 'Transakcije',
    dates: 'Datumi',
    noneYet: 'Još nema',
    range: (from, to) => `od ${from} do ${to}`,
    account: 'Račun u banci',
    accounts: 'Računi u banci',
    categories: 'Kategorije',
    refusedHelp: 'Otvorite Excel preuzet iz Google tablice, datoteku koju je aplikacija izvezla ili Kuninu datoteku iz mape sigurnosnih kopija.',
    records: (count) => ({ one: `${count} zapis, po listovima`, few: `${count} zapisa, po listovima`, other: `${count} zapisa, po listovima` }),
    defaulted: (tabs) =>
      tabs.length === 1
        ? `Nema lista ${tabs[0]}, pa se čita kao prazan i vrijede zadane vrijednosti.`
        : `Nema listova ${tabs.slice(0, -1).join(', ')} ni ${tabs[tabs.length - 1]}, pa se čitaju kao prazni i vrijede zadane vrijednosti.`,
    problems: (count) => ({
      one: `${count} redak koji aplikacija nije mogla upotrijebiti kako je zapisan`,
      few: `${count} retka koja aplikacija nije mogla upotrijebiti kako su zapisana`,
      other: `${count} redaka koje aplikacija nije mogla upotrijebiti kako su zapisani`,
    }),
    clean: 'Svi retci čitaju se bez problema.',
  },
}

export const words = language === 'hr' ? hr : en
