import type { FirstRunWords } from '../../../../shared/storage/presentation/fileFirstRun'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Investments file is datoteka ulaganja in Croatian.

export const en = {
  lead: 'Every buy, sale, dividend and deposit at your brokers, in a file of its own, with what it is worth and what it earned.',
  footer: 'No server. The Investments file stays in your Google Drive, this browser and the files you export.',
  home: {
    title: 'Where the Investments file lives',
    dropsTitle: 'The Investments file in this browser is deleted when the one on Drive opens',
    notMade: 'The Investments file was not made',
  },
  folder: {
    title: 'Where the Investments file is saved',
    savedIn: 'The Investments file will be saved in',
    choose: 'Choose the folder the Investments file goes in. The app writes only its file there and the backups folder beside it.',
    onDriveTitle: 'Your Investments file is on Drive already',
    onDriveDrops: (message: string) =>
      `${message} Opening it deletes the Investments file in this browser, which exists only here and in the files you exported. Export it first if you want to keep it.`,
    openOnDrive: 'Open the Investments file on Drive',
  },
  find: {
    title: 'Find your Investments file on Drive',
    before: 'Find the file opens ',
    after:
      ', the file the app marked as the Investments file, or asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this browser.',
  },
} satisfies FirstRunWords

export const hr: Translation<typeof en> = {
  lead: 'Svaka kupnja, prodaja, dividenda i uplata kod vaših brokera, u zasebnoj datoteci, s vrijednošću i zaradom.',
  footer: 'Bez poslužitelja. Datoteka ulaganja ostaje na vašem Google Driveu, u ovom pregledniku i u datotekama koje izvezete.',
  home: {
    title: 'Gdje se čuva datoteka ulaganja',
    dropsTitle: 'Datoteka ulaganja u ovom pregledniku briše se kad se otvori ona s Drivea',
    notMade: 'Datoteka ulaganja nije napravljena',
  },
  folder: {
    title: 'Gdje se sprema datoteka ulaganja',
    savedIn: 'Datoteka ulaganja spremit će se u mapu',
    choose: 'Odaberite mapu za datoteku ulaganja. Aplikacija ondje upisuje samo svoju datoteku i mapu sa sigurnosnim kopijama uz nju.',
    onDriveTitle: 'Datoteka ulaganja već je na Driveu',
    onDriveDrops: (message) =>
      `${message} Ako je otvorite, briše se datoteka ulaganja u ovom pregledniku, koja postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako je želite sačuvati.`,
    openOnDrive: 'Otvori datoteku ulaganja na Driveu',
  },
  find: {
    title: 'Pronađite datoteku ulaganja na Driveu',
    before: '„Pronađi datoteku” otvara ',
    after:
      ', datoteku koju je aplikacija označila kao datoteku ulaganja, ili traži da je odaberete kad je nema. „Odaberi drugu datoteku” omogućuje da sami odaberete .json datoteku. Aplikacija čuva kopiju u ovom pregledniku.',
  },
}

export const words = language === 'hr' ? hr : en
