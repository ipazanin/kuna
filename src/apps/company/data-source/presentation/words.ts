import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The books file is datoteka, so that knjige keeps its legal sense.

export const en = {
  switchTitle: 'Switch data source',
  switchDescription: 'Show a different workbook. The figures follow whichever you choose.',
  deletedOnSwitch: 'The workbook in this browser is deleted when you switch',
  deletedOnSwitchDescription: 'It exists only here and in the files you exported. Export it first if you want to keep your latest changes.',
  drive: {
    title: 'Open your books on Google Drive',
    titleAgain: 'Open your books on Google Drive again',
    description:
      'For books another device keeps on Drive. Sign in with Google, then Find the file opens the file the app marked as its books, or asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this browser, and writes only that file and the backups folder beside it.',
    find: 'Find the file',
    pick: 'Pick another file',
    cookies: 'Google may ask about cookies first, then brings you back here.',
  },
  file: {
    title: 'Open a file',
    description: 'An Excel workbook, such as a download of your Google Sheet, or a Kuna file from the backups folder. Check what it holds, then keep it on Google Drive or in this browser.',
    drop: 'Drop an .xlsx or .json file here',
    orChoose: 'or click to choose one',
  },
  newBooks: {
    title: 'Start new books',
    description: 'The default categories and no rows yet. A few questions set them up, then you import a bank statement.',
    start: 'Start new books',
  },
}

export const hr: Translation<typeof en> = {
  switchTitle: 'Promijeni izvor podataka',
  switchDescription: 'Prikažite drugu datoteku. Iznosi slijede onu koju odaberete.',
  deletedOnSwitch: 'Datoteka u ovom pregledniku briše se kad promijenite izvor',
  deletedOnSwitchDescription: 'Postoji samo ovdje i u datotekama koje ste izvezli. Najprije je izvezite ako želite sačuvati zadnje promjene.',
  drive: {
    title: 'Otvori datoteku na Google Driveu',
    titleAgain: 'Ponovno otvori datoteku na Google Driveu',
    description:
      'Za datoteku koju drugi uređaj čuva na Driveu. Prijavite se Googleom, a zatim „Pronađi datoteku” otvara datoteku koju je aplikacija označila kao svoju ili traži da je odaberete ako takve nema. „Odaberi drugu datoteku” omogućuje da sami odaberete .json datoteku. Aplikacija čuva kopiju u ovom pregledniku i piše samo u tu datoteku i u mapu sigurnosnih kopija pokraj nje.',
    find: 'Pronađi datoteku',
    pick: 'Odaberi drugu datoteku',
    cookies: 'Google vas najprije može pitati za kolačiće, a zatim vas vraća ovamo.',
  },
  file: {
    title: 'Otvori datoteku',
    description:
      'Excel datoteka, na primjer preuzeta Google tablica, ili Kunina datoteka iz mape sigurnosnih kopija. Provjerite što sadrži, a zatim je čuvajte na Google Driveu ili u ovom pregledniku.',
    drop: 'Ispustite .xlsx ili .json datoteku ovdje',
    orChoose: 'ili kliknite i odaberite je',
  },
  newBooks: {
    title: 'Započni novu datoteku',
    description: 'Zadane kategorije i još nijedna stavka. Nekoliko pitanja sve postavi, a zatim uvezete bankovni izvod.',
    start: 'Započni novu datoteku',
  },
}

export const words = language === 'hr' ? hr : en
