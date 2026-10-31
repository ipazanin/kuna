import { language } from '../text/language'
import { plural } from '../text/translation'
import type { Translation } from '../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  staysOnPage: 'This page holds no Google access for this, and asking for it on a phone would leave the page. Sync or Allow access first, then try again.',
  popupBlocked: "The browser blocked Google's window.",
  popupClosed: "Google's window was closed before access was allowed.",
  refused: (error: string, description: string) => `Google refused access: ${error} ${description}`.trim(),
  unfinished: (type: string, message: string) => `Google's window did not finish: ${type} ${message}`.trim(),
  notGranted: {
    'drive.file': 'Google Drive access was not allowed, so the app cannot read or save the books.',
    'drive.readonly': 'Drive read access was not allowed, so the app cannot read your Drive folders.',
    'gmail.readonly': 'Gmail read access was not allowed, so the app cannot look for the mail it would file.',
    'gmail.compose': 'Gmail access was not allowed, so no draft can be saved. Leave "Create the mail draft" off to write the mail yourself.',
  },
  noSiteStorage: "This browser keeps no site storage, so the app could not check Google's answer. Sign in from an ordinary window.",
  notLoaded: (source: string) => `Could not load ${source}. A content blocker or the network may have stopped it.`,
  booksFolder: 'The folder of the books file',
  /** Why a folder path leads nowhere, as a refusal starts it. */
  noFolder: (where: string, name: string) => `${where} holds no folder named "${name}"`,
  severalFolders: (where: string, count: number, name: string) => `${where} holds ${count} folders named "${name}"`,
}

export const hr: Translation<typeof en> = {
  staysOnPage: 'Ova stranica nema Googleov pristup za ovo, a traženje pristupa na mobitelu napustilo bi stranicu. Najprije sinkronizirajte ili dopustite pristup, a zatim pokušajte ponovno.',
  popupBlocked: 'Preglednik je blokirao Googleov prozor.',
  popupClosed: 'Googleov prozor zatvoren je prije nego što je pristup dopušten.',
  refused: (error, description) => `Google je odbio pristup: ${error} ${description}`.trim(),
  unfinished: (type, message) => `Googleov prozor nije završio: ${type} ${message}`.trim(),
  notGranted: {
    'drive.file': 'Pristup Google Driveu nije dopušten, pa aplikacija ne može čitati ni spremati datoteku.',
    'drive.readonly': 'Čitanje Drivea nije dopušteno, pa aplikacija ne može čitati vaše mape na Driveu.',
    'gmail.readonly': 'Čitanje Gmaila nije dopušteno, pa aplikacija ne može tražiti poštu koju bi spremila.',
    'gmail.compose': 'Pristup Gmailu nije dopušten, pa se skica ne može spremiti. Ostavite izradu skice isključenom i napišite poruku sami.',
  },
  noSiteStorage: 'Ovaj preglednik ne čuva podatke stranica, pa aplikacija nije mogla provjeriti Googleov odgovor. Prijavite se iz običnog prozora.',
  notLoaded: (source) => `Nije se moglo učitati ${source}. Možda ga je zaustavio bloker sadržaja ili mreža.`,
  booksFolder: 'Mapa datoteke',
  noFolder: (where, name) => `${where} nema mapu „${name}”`,
  severalFolders: (where, count, name) => `${where} ima ${plural({ one: `${count} mapu`, few: `${count} mape`, other: `${count} mapa` }, count)} naziva „${name}”`,
}

export const words = language === 'hr' ? hr : en
