import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Loans file is datoteka kredita in Croatian.

export const en = {
  lead: "Your loans, in a file of their own beside the company's books.",
  footer: 'No server. The Loans file stays in your Google Drive, this browser and the files you export.',
  home: {
    title: 'Where the Loans file lives',
    drive: 'A new file on Google Drive',
    driveNote: 'One file you open on your phone and computer. Backed up daily.',
    browser: 'A new file in this browser',
    browserNote: 'No Google. One device. Export to keep a copy.',
    open: 'My file on Google Drive',
    openNote: 'Another device already keeps it.',
    dropsTitle: 'The Loans file in this browser is deleted when the one on Drive opens',
    drops: 'It exists only here and in the files you exported. Export it first if you want to keep it.',
    notMade: 'The Loans file was not made',
    continue: 'Continue',
  },
  folder: {
    title: 'Where the Loans file is saved',
    subtitle: 'The Picker opens at My Drive. Nothing is made until you confirm the folder.',
    savedIn: 'The Loans file will be saved in',
    unseen: ', inside folders the app cannot see. Open it in Drive to check where it is.',
    withBackups: ', with a backups folder beside it',
    openFolder: 'Open this folder in Drive',
    choose: 'Choose the folder the Loans file goes in. The app writes only its file there and the backups folder beside it.',
    failed: 'That did not work',
    onDriveTitle: 'Your Loans file is on Drive already',
    onDriveDrops: (message: string) => `${message} Opening it deletes the Loans file in this browser, which exists only here and in the files you exported. Export it first if you want to keep it.`,
    chooseAgain: 'Choose a folder again',
    openOnDrive: 'Open the Loans file on Drive',
    chooseAnother: 'Choose another',
    create: 'Create the file here',
    chooseFirst: 'Choose a folder in Google Drive',
    created: (name: string, folder: string) => `Created ${name} in ${folder}`,
    createdNote: 'The app keeps a copy in this browser, and a backups folder beside the file.',
  },
  find: {
    title: 'Find your Loans file on Drive',
    before: 'Find the file opens ',
    after: ', the file the app marked as the Loans file, or asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this browser.',
    pick: 'Pick another file',
    find: 'Find the file',
  },
}

export const hr: Translation<typeof en> = {
  lead: 'Vaši krediti, u zasebnoj datoteci uz datoteku tvrtke.',
  footer: 'Bez poslužitelja. Datoteka kredita ostaje na vašem Google Driveu, u ovom pregledniku i u datotekama koje izvezete.',
  home: {
    title: 'Gdje se čuva datoteka kredita',
    drive: 'Nova datoteka na Google Driveu',
    driveNote: 'Jedna datoteka koju otvarate na mobitelu i računalu. Sigurnosna kopija svaki dan.',
    browser: 'Nova datoteka u ovom pregledniku',
    browserNote: 'Bez Googlea. Jedan uređaj. Izvezite je da sačuvate kopiju.',
    open: 'Moja datoteka na Google Driveu',
    openNote: 'Već je čuva drugi uređaj.',
    dropsTitle: 'Datoteka kredita u ovom pregledniku briše se kad se otvori ona s Drivea',
    drops: 'Postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako je želite sačuvati.',
    notMade: 'Datoteka kredita nije napravljena',
    continue: 'Nastavi',
  },
  folder: {
    title: 'Gdje se sprema datoteka kredita',
    subtitle: 'Prozor za odabir otvara se u mapi Moj disk. Ništa se ne stvara dok ne potvrdite mapu.',
    savedIn: 'Datoteka kredita spremit će se u mapu',
    unseen: ', unutar mapa koje aplikacija ne vidi. Otvorite je na Driveu da provjerite gdje je.',
    withBackups: ', uz mapu sa sigurnosnim kopijama',
    openFolder: 'Otvori ovu mapu na Driveu',
    choose: 'Odaberite mapu za datoteku kredita. Aplikacija ondje upisuje samo svoju datoteku i mapu sa sigurnosnim kopijama uz nju.',
    failed: 'To nije uspjelo',
    onDriveTitle: 'Datoteka kredita već je na Driveu',
    onDriveDrops: (message) =>
      `${message} Ako je otvorite, briše se datoteka kredita u ovom pregledniku, koja postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako je želite sačuvati.`,
    chooseAgain: 'Ponovno odaberi mapu',
    openOnDrive: 'Otvori datoteku kredita na Driveu',
    chooseAnother: 'Odaberi drugu',
    create: 'Napravi datoteku ovdje',
    chooseFirst: 'Odaberi mapu na Google Driveu',
    created: (name, folder) => `Datoteka ${name} napravljena je u mapi ${folder}`,
    createdNote: 'Aplikacija čuva kopiju u ovom pregledniku i mapu sa sigurnosnim kopijama uz datoteku.',
  },
  find: {
    title: 'Pronađite datoteku kredita na Driveu',
    before: '„Pronađi datoteku” otvara ',
    after:
      ', datoteku koju je aplikacija označila kao datoteku kredita, ili traži da je odaberete kad je nema. „Odaberi drugu datoteku” omogućuje da sami odaberete .json datoteku. Aplikacija čuva kopiju u ovom pregledniku.',
    pick: 'Odaberi drugu datoteku',
    find: 'Pronađi datoteku',
  },
}

export const words = language === 'hr' ? hr : en
