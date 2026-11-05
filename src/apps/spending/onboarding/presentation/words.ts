import type { FirstRunWords } from '../../../../shared/storage/presentation/fileFirstRun'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Spending file is datoteka potrošnje in Croatian.

export const en = {
  lead: 'Your accounts, what you spend and your monthly limits, in a file of their own.',
  footer: 'No server. The Spending file stays in your Google Drive, this browser and the files you export.',
  home: {
    title: 'Where the Spending file lives',
    dropsTitle: 'The Spending file in this browser is deleted when the one on Drive opens',
    notMade: 'The Spending file was not made',
  },
  folder: {
    title: 'Where the Spending file is saved',
    savedIn: 'The Spending file will be saved in',
    choose: 'Choose the folder the Spending file goes in. The app writes only its file there and the backups folder beside it.',
    onDriveTitle: 'Your Spending file is on Drive already',
    onDriveDrops: (message: string) => `${message} Opening it deletes the Spending file in this browser, which exists only here and in the files you exported. Export it first if you want to keep it.`,
    openOnDrive: 'Open the Spending file on Drive',
  },
  find: {
    title: 'Find your Spending file on Drive',
    before: 'Find the file opens ',
    after:
      ', the file the app marked as the Spending file, or asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this browser.',
  },
} satisfies FirstRunWords

export const hr: Translation<typeof en> = {
  lead: 'Vaši računi, potrošnja i mjesečna ograničenja u zasebnoj datoteci.',
  footer: 'Bez poslužitelja. Datoteka potrošnje ostaje na vašem Google Driveu, u ovom pregledniku i u datotekama koje izvezete.',
  home: {
    title: 'Gdje se čuva datoteka potrošnje',
    dropsTitle: 'Datoteka potrošnje u ovom pregledniku briše se kad se otvori ona s Drivea',
    notMade: 'Datoteka potrošnje nije izrađena',
  },
  folder: {
    title: 'Gdje se sprema datoteka potrošnje',
    savedIn: 'Datoteka potrošnje spremit će se u mapu',
    choose: 'Odaberite mapu za datoteku potrošnje. Aplikacija ondje upisuje samo svoju datoteku i mapu sa sigurnosnim kopijama uz nju.',
    onDriveTitle: 'Datoteka potrošnje već je na Driveu',
    onDriveDrops: (message) =>
      `${message} Ako je otvorite, briše se datoteka potrošnje u ovom pregledniku, koja postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako je želite sačuvati.`,
    openOnDrive: 'Otvori datoteku potrošnje na Driveu',
  },
  find: {
    title: 'Pronađite datoteku potrošnje na Driveu',
    before: '„Pronađi datoteku” otvara ',
    after:
      ', datoteku koju je aplikacija označila kao datoteku potrošnje, ili traži da je odaberete kad je nema. „Odaberi drugu datoteku” omogućuje da sami odaberete .json datoteku. Aplikacija čuva kopiju u ovom pregledniku.',
  },
}

export const words = language === 'hr' ? hr : en
