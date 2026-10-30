import type { FirstRunWords } from '../../../../shared/storage/presentation/fileFirstRun'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Loans file is datoteka kredita in Croatian.

export const en = {
  lead: "Your loans, in a file of their own beside the company's books.",
  footer: 'No server. The Loans file stays in your Google Drive, this browser and the files you export.',
  home: {
    title: 'Where the Loans file lives',
    dropsTitle: 'The Loans file in this browser is deleted when the one on Drive opens',
    notMade: 'The Loans file was not made',
  },
  folder: {
    title: 'Where the Loans file is saved',
    savedIn: 'The Loans file will be saved in',
    choose: 'Choose the folder the Loans file goes in. The app writes only its file there and the backups folder beside it.',
    onDriveTitle: 'Your Loans file is on Drive already',
    onDriveDrops: (message: string) => `${message} Opening it deletes the Loans file in this browser, which exists only here and in the files you exported. Export it first if you want to keep it.`,
    openOnDrive: 'Open the Loans file on Drive',
  },
  find: {
    title: 'Find your Loans file on Drive',
    before: 'Find the file opens ',
    after: ', the file the app marked as the Loans file, or asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this browser.',
  },
} satisfies FirstRunWords

export const hr: Translation<typeof en> = {
  lead: 'Vaši krediti, u zasebnoj datoteci uz datoteku tvrtke.',
  footer: 'Bez poslužitelja. Datoteka kredita ostaje na vašem Google Driveu, u ovom pregledniku i u datotekama koje izvezete.',
  home: {
    title: 'Gdje se čuva datoteka kredita',
    dropsTitle: 'Datoteka kredita u ovom pregledniku briše se kad se otvori ona s Drivea',
    notMade: 'Datoteka kredita nije napravljena',
  },
  folder: {
    title: 'Gdje se sprema datoteka kredita',
    savedIn: 'Datoteka kredita spremit će se u mapu',
    choose: 'Odaberite mapu za datoteku kredita. Aplikacija ondje upisuje samo svoju datoteku i mapu sa sigurnosnim kopijama uz nju.',
    onDriveTitle: 'Datoteka kredita već je na Driveu',
    onDriveDrops: (message) =>
      `${message} Ako je otvorite, briše se datoteka kredita u ovom pregledniku, koja postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako je želite sačuvati.`,
    openOnDrive: 'Otvori datoteku kredita na Driveu',
  },
  find: {
    title: 'Pronađite datoteku kredita na Driveu',
    before: '„Pronađi datoteku” otvara ',
    after:
      ', datoteku koju je aplikacija označila kao datoteku kredita, ili traži da je odaberete kad je nema. „Odaberi drugu datoteku” omogućuje da sami odaberete .json datoteku. Aplikacija čuva kopiju u ovom pregledniku.',
  },
}

export const words = language === 'hr' ? hr : en
