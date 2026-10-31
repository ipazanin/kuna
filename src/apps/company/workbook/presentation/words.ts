import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The books file is datoteka, so that knjige keeps its legal sense of the accountant's books. A file name stays as Drive or the file system writes it.

export const en = {
  newerFile: {
    title: 'A newer version of Kuna saved this file',
    description: 'Reload to update before you change anything. Until then the app shows the file and saves nothing to it.',
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
    driveEmpty: 'Import a bank statement, or sync once the statements folder holds one.',
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
  newerFile: {
    title: 'Ovu je datoteku spremila novija verzija Kune',
    description: 'Ponovno učitajte stranicu da se aplikacija ažurira prije nego što išta promijenite. Do tada aplikacija prikazuje datoteku i ništa u nju ne sprema.',
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
    driveEmpty: 'Uvezite bankovni izvod ili sinkronizirajte kad mapa izvoda bude imala neki.',
    importStatement: 'Uvezi izvod',
    exportToExcel: 'Izvezi u Excel',
    openSettings: 'Otvori postavke',
    reading: 'Čitanje datoteke',
    onItsWay: 'Prva kopija stiže.',
    syncToRead: (name) => (name === null ? 'Sinkronizirajte da se datoteka pročita' : `Sinkronizirajte da se pročita „${name}”`),
    noCopy: 'Ovaj preglednik još nema njezinu kopiju.',
    sync: 'Sinkroniziraj',
  },
}

export const words = language === 'hr' ? hr : en
