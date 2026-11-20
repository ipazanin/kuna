import { language } from '../../../../shared/text/language'
import type { EnglishForms, Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The books file is datoteka, so that knjige keeps its legal sense of the accountant's books. A file name stays as Drive or the file system writes it.

export const en = {
  /** The prompt that gives every ledger row without an id one. */
  rowIds: {
    title: (count: number): EnglishForms => ({ one: `${count} ledger row has no id yet`, other: `${count} ledger rows have no id yet` }),
    description: "Kuna ties a split part, and an asset, to its bank row by the row's id. These older rows are found by their day, amount and balance instead, so correcting one loses its split.",
    give: 'Give the rows ids',
    given: (count: number): EnglishForms => ({ one: `Gave ${count} ledger row its id`, other: `Gave ${count} ledger rows their ids` }),
    notGiven: 'The ledger rows kept no new ids',
  },
  /** The offer to move books from before items to the items tab, or what keeps them from moving. */
  itemsMove: {
    title: 'This file keeps categories the way older versions of Kuna did',
    description:
      'Updating it gives each bank row its own parts, which hold its category, owner share, note and the invoice it pays. A split row keeps its parts, and a payment that pays several invoices then shows as one part per invoice. No figure changes. Undo works until you reload the page. To keep this version, export a copy first.',
    action: 'Update the file',
    moved: 'Updated how this file keeps categories',
    notMoved: 'The file was not updated',
    blocked: (count: number): EnglishForms => ({
      one: `${count} row or part needs fixing before this file can be updated`,
      other: `${count} rows or parts need fixing before this file can be updated`,
    }),
    unreadableRow: (label: string) => `The ledger row ${label} cannot be read.`,
    refusedParts: (count: number): EnglishForms => ({
      one: 'A part on the splits tab cannot be read, nor which bank row it belongs to.',
      other: `${count} parts on the splits tab cannot be read, nor which bank rows they belong to.`,
    }),
    refusedPartsOfRow: (count: number, account: string, day: string): EnglishForms => ({
      one: `A split part of the ${account} row of ${day} cannot be read, or its split does not add up.`,
      other: `${count} split parts of the ${account} row of ${day} cannot be read, or its split does not add up.`,
    }),
    keptWhole: (account: string, day: string) => `The ${account} row of ${day} is split, though it counts whole.`,
    zeroRow: (account: string, day: string) => `The ${account} row of ${day} has no amount.`,
    blockedFix: 'Fix or delete each of them in the file. Then the update is offered again.',
  },
  /** What a file chosen as books says when it cannot be read. */
  reading: {
    notExcel: (fileName: string) => `${fileName} could not be read as an Excel workbook. Save it as .xlsx and try again.`,
    notKuna: (fileName: string) => `${fileName} could not be read as a Kuna file.`,
    otherApp: (fileName: string, app: string) => `${fileName} holds the books of another Kuna app, ${app}.`,
    nothingToExport: 'There is no workbook to export yet.',
  },
  /** The toasts of opening the books on Drive. */
  find: {
    notOpened: 'Your books were not opened',
    onDrive: 'on Google Drive',
    inFolder: (folder: string) => `in ${folder} on Google Drive`,
    alreadyOpen: 'Your books are already open',
    opened: (name: string) => `Opened ${name}`,
    readAgain: (name: string, where: string) => `${name} ${where} is the file on screen, read again just now. To open a different file, use Pick another file.`,
    onScreen: (name: string, where: string) => `${name} ${where} is on screen now, and the app keeps a copy in this browser.`,
  },
  /** What a screen shows until books with transactions are on it. */
  gate: {
    browserUnread: 'The workbook in this browser could not be read',
    driveUnread: 'The file on Drive could not be read',
    tryAgain: 'Try again',
    noTransactions: 'The ledger has no transactions yet',
    browserEmpty: 'Import a bank statement, or export the workbook, add your bank rows to its ledger tab in Excel and import the file again. Categories and settings can be set up here first.',
    driveEmpty: 'Import a bank statement, or sync once the bank has mailed one.',
    importStatement: 'Import a statement',
    exportToExcel: 'Export to Excel',
    openSettings: 'Open Settings',
    reading: 'Reading the file',
    onItsWay: 'The first copy is on its way.',
    syncToRead: (name: string | null) => `Sync to read ${name ?? 'the file'}`,
    noCopy: 'This browser has no copy of it yet.',
    sync: 'Sync',
  },
}

export const hr: Translation<typeof en> = {
  rowIds: {
    title: (count) => ({ one: `${count} stavka evidencije još nema ID`, few: `${count} stavke evidencije još nemaju ID`, other: `${count} stavki evidencije još nema ID` }),
    description:
      'Kuna povezuje dio podjele i sredstvo s bankovnom stavkom po njezinu ID-u. Ove starije stavke pronalaze se po danu, iznosu i saldu, pa se ispravkom takve stavke gubi njezina podjela.',
    give: 'Dodijeli ID-ove',
    given: (count) => ({
      one: `${count} stavka evidencije dobila je ID`,
      few: `${count} stavke evidencije dobile su ID`,
      other: `${count} stavki evidencije dobilo je ID`,
    }),
    notGiven: 'Stavke evidencije nisu dobile nove ID-ove',
  },
  itemsMove: {
    title: 'Ova datoteka vodi kategorije kao starije verzije Kune',
    description:
      'Ažuriranjem svaka bankovna stavka dobiva svoje dijelove, koji nose njezinu kategoriju, udio vlasnika, napomenu i račun koji plaća. Podijeljena stavka zadržava svoje dijelove, a uplata koja plaća više računa tada se prikazuje kao jedan dio po računu. Nijedna se brojka ne mijenja. Poništi radi dok ponovno ne učitate stranicu. Ako želite sačuvati ovu verziju, prvo izvezite kopiju.',
    action: 'Ažuriraj datoteku',
    moved: 'Datoteka je ažurirana',
    notMoved: 'Datoteka nije ažurirana',
    blocked: (count) => ({
      one: `${count} stavku ili dio treba ispraviti prije ažuriranja ove datoteke`,
      few: `${count} stavke ili dijela treba ispraviti prije ažuriranja ove datoteke`,
      other: `${count} stavki ili dijelova treba ispraviti prije ažuriranja ove datoteke`,
    }),
    unreadableRow: (label) => `Stavka evidencije ${label} ne može se pročitati.`,
    refusedParts: (count) => ({
      one: `${count} dio na listu „splits” ne može se pročitati, kao ni kojoj bankovnoj stavci pripada.`,
      few: `${count} dijela na listu „splits” ne mogu se pročitati, kao ni kojim bankovnim stavkama pripadaju.`,
      other: `${count} dijelova na listu „splits” ne može se pročitati, kao ni kojim bankovnim stavkama pripadaju.`,
    }),
    refusedPartsOfRow: (count, account, day) => ({
      one: `${count} dio podjele stavke računa „${account}” od ${day} ne može se pročitati ili se podjela ne zbraja.`,
      few: `${count} dijela podjele stavke računa „${account}” od ${day} ne mogu se pročitati ili se podjela ne zbraja.`,
      other: `${count} dijelova podjele stavke računa „${account}” od ${day} ne može se pročitati ili se podjela ne zbraja.`,
    }),
    keptWhole: (account, day) => `Stavka računa „${account}” od ${day} podijeljena je, iako se broji cijela.`,
    zeroRow: (account, day) => `Stavka računa „${account}” od ${day} nema iznos.`,
    blockedFix: 'Ispravite ili obrišite svaku od njih u datoteci. Tada će se ažuriranje ponovno ponuditi.',
  },
  reading: {
    notExcel: (fileName) => `Datoteka „${fileName}” nije se mogla pročitati kao Excelova datoteka. Spremite je kao .xlsx i pokušajte ponovno.`,
    notKuna: (fileName) => `Datoteka „${fileName}” nije se mogla pročitati kao Kunina datoteka.`,
    otherApp: (fileName, app) => `Datoteka „${fileName}” pripada drugoj Kuninoj aplikaciji, ${app}.`,
    nothingToExport: 'Još nema datoteke za izvoz.',
  },
  find: {
    notOpened: 'Datoteka nije otvorena',
    onDrive: 'na Google Driveu',
    inFolder: (folder) => `u mapi „${folder}” na Google Driveu`,
    alreadyOpen: 'Datoteka je već otvorena',
    opened: (name) => `Otvorena je datoteka „${name}”`,
    readAgain: (name, where) => `Na zaslonu je datoteka „${name}” ${where}, upravo ponovno pročitana. Za drugu datoteku upotrijebite „Odaberi drugu datoteku”.`,
    onScreen: (name, where) => `Na zaslonu je sada datoteka „${name}” ${where}, a aplikacija čuva kopiju u ovom pregledniku.`,
  },
  gate: {
    browserUnread: 'Datoteka u ovom pregledniku nije se mogla pročitati',
    driveUnread: 'Datoteka na Driveu nije se mogla pročitati',
    tryAgain: 'Pokušaj ponovno',
    noTransactions: 'Evidencija još nema transakcija',
    browserEmpty: 'Uvezite bankovni izvod ili izvezite datoteku, u Excelu dodajte bankovne stavke na list „ledger” i ponovno uvezite datoteku. Kategorije i postavke možete najprije urediti ovdje.',
    driveEmpty: 'Uvezite bankovni izvod ili sinkronizirajte kad vam ga banka pošalje poštom.',
    importStatement: 'Uvezi izvod',
    exportToExcel: 'Izvezi u Excel',
    openSettings: 'Otvori postavke',
    reading: 'Čitanje datoteke',
    onItsWay: 'Prva kopija stiže.',
    syncToRead: (name) => (name === null ? 'Sinkroniziraj da se datoteka pročita' : `Sinkroniziraj da se pročita „${name}”`),
    noCopy: 'Ovaj preglednik još nema njezinu kopiju.',
    sync: 'Sinkroniziraj',
  },
}

export const words = language === 'hr' ? hr : en
