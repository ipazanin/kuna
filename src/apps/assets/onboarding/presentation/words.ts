import type { FirstRunWords } from '../../../../shared/storage/presentation/fileFirstRun'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Assets file is datoteka imovine in Croatian.

export const en = {
  lead: 'Your flat, your car and the other things you own, in a file of their own, with what each is worth today.',
  footer: 'No server. The Assets file stays in your Google Drive, this browser and the files you export.',
  home: {
    title: 'Where the Assets file lives',
    dropsTitle: 'The Assets file in this browser is deleted when the one on Drive opens',
    notMade: 'The Assets file was not made',
  },
  folder: {
    title: 'Where the Assets file is saved',
    savedIn: 'The Assets file will be saved in',
    choose: 'Choose the folder the Assets file goes in. The app writes only its file there and the backups folder beside it.',
    onDriveTitle: 'Your Assets file is on Drive already',
    onDriveDrops: (message: string) => `${message} Opening it deletes the Assets file in this browser, which exists only here and in the files you exported. Export it first if you want to keep it.`,
    openOnDrive: 'Open the Assets file on Drive',
  },
  find: {
    title: 'Find your Assets file on Drive',
    before: 'Find the file opens ',
    after: ', the file the app marked as the Assets file, or asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this browser.',
  },
} satisfies FirstRunWords

export const hr: Translation<typeof en> = {
  lead: 'Vaš stan, automobil i ostala imovina u zasebnoj datoteci, s današnjom vrijednošću svake stavke.',
  footer: 'Bez poslužitelja. Datoteka imovine ostaje na vašem Google Driveu, u ovom pregledniku i u datotekama koje izvezete.',
  home: {
    title: 'Gdje se čuva datoteka imovine',
    dropsTitle: 'Datoteka imovine u ovom pregledniku briše se kad se otvori ona s Drivea',
    notMade: 'Datoteka imovine nije izrađena',
  },
  folder: {
    title: 'Gdje se sprema datoteka imovine',
    savedIn: 'Datoteka imovine spremit će se u mapu',
    choose: 'Odaberite mapu za datoteku imovine. Aplikacija ondje upisuje samo svoju datoteku i mapu sa sigurnosnim kopijama uz nju.',
    onDriveTitle: 'Datoteka imovine već je na Driveu',
    onDriveDrops: (message) =>
      `${message} Ako je otvorite, briše se datoteka imovine u ovom pregledniku, koja postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako je želite sačuvati.`,
    openOnDrive: 'Otvori datoteku imovine na Driveu',
  },
  find: {
    title: 'Pronađite datoteku imovine na Driveu',
    before: '„Pronađi datoteku” otvara ',
    after:
      ', datoteku koju je aplikacija označila kao datoteku imovine, ili traži da je odaberete kad je nema. „Odaberi drugu datoteku” omogućuje da sami odaberete .json datoteku. Aplikacija čuva kopiju u ovom pregledniku.',
  },
}

export const words = language === 'hr' ? hr : en
