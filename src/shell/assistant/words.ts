import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  purpose: 'Screens that belong to no one app, and the settings of this device that every app follows.',
  on: 'On',
  off: 'Off',
  thisDevice: 'This device',
  outside: {
    reloads: 'This card has no Undo. Kuna loads again in the new language, and the chat stays.',
  },
  home: {
    drive: 'Google Drive',
    browser: 'This browser',
    askAgain: 'Ask again',
  },
  refused: {
    same: 'Nothing would change, as that is already set.',
    twice: 'A card changes each setting once.',
    noAnswer: 'Kuna has not asked yet which apps you use. The home asks on the first visit, so link the home and let the person answer there.',
    inUse: 'That app is already in use on this device.',
    notAnswered: 'Kuna already asks where new files go, as this device keeps no answer.',
    changedSince: 'Nothing was changed. That setting was changed since the card was made.',
  },
  settings: {
    theme: 'The look on this device: system, light or dark.',
    language: 'The language on this device: browser, en or hr. Changing it loads Kuna again.',
    autoSync: 'Whether this device syncs as Kuna opens and when it comes back after ten minutes.',
    apps: 'The apps the person said they use. An app left out waits under Other apps on the home until it has a file.',
    filesHome: 'Where new files go, Google Drive or this browser. The chat may only forget the answer, so Kuna asks again.',
    neverProvider: 'The AI company, its key and its model, and fetching or deleting keys kept in the Google account.',
    neverAnonymise: 'Anonymise for each AI company, and each app’s Send without asking. They guard what the chat sends.',
    neverHistory: 'Clearing the chat history.',
    neverSync: 'Sync now, and allowing Google access a sync misses. Google’s consent window needs the person, and a sync is started from the top bar.',
    neverGoogle: 'Signing out of Google, and deleting all of Kuna.',
  },
}

export const hr: Translation<typeof en> = {
  purpose: 'Zasloni koji ne pripadaju nijednoj aplikaciji i postavke ovog uređaja koje prate sve aplikacije.',
  on: 'Uključeno',
  off: 'Isključeno',
  thisDevice: 'Ovaj uređaj',
  outside: {
    reloads: 'Ova kartica nema poništavanje. Kuna se ponovno učitava na novom jeziku, a chat ostaje.',
  },
  home: {
    drive: 'Google Drive',
    browser: 'Ovaj preglednik',
    askAgain: 'Pitaj ponovno',
  },
  refused: {
    same: 'Ništa se ne bi promijenilo jer je to već postavljeno.',
    twice: 'Kartica svaku postavku mijenja jednom.',
    noAnswer: 'Kuna još nije pitala koje aplikacije koristite. Početna stranica to pita pri prvom posjetu, pa povežite početnu stranicu i neka osoba odgovori ondje.',
    inUse: 'Ta se aplikacija na ovom uređaju već koristi.',
    notAnswered: 'Kuna već pita gdje idu nove datoteke jer ovaj uređaj ne čuva odgovor.',
    changedSince: 'Ništa nije promijenjeno. Ta je postavka promijenjena nakon što je kartica napravljena.',
  },
  settings: {
    theme: 'Izgled na ovom uređaju: „system”, „light” ili „dark”.',
    language: 'Jezik na ovom uređaju: „browser”, „en” ili „hr”. Promjena ponovno učitava Kunu.',
    autoSync: 'Sinkronizira li se ovaj uređaj kad se Kuna otvori i kad joj se vratite nakon deset minuta.',
    apps: 'Aplikacije za koje je osoba rekla da ih koristi. Izostavljena aplikacija čeka pod Ostale aplikacije na početnoj stranici dok ne dobije datoteku.',
    filesHome: 'Gdje idu nove datoteke, Google Drive ili ovaj preglednik. Chat smije samo zaboraviti odgovor, pa Kuna ponovno pita.',
    neverProvider: 'AI tvrtka, njezin ključ i model te dohvat ili brisanje ključeva spremljenih na Google računu.',
    neverAnonymise: 'Anonimiziraj za svaku AI tvrtku i Šalji bez pitanja svake aplikacije. Oni čuvaju ono što chat šalje.',
    neverHistory: 'Brisanje povijesti chata.',
    neverSync: 'Sinkroniziraj sada i dopuštanje Google pristupa koji sinkronizaciji nedostaje. Googleov prozor za privolu traži osobu, a sinkronizacija se pokreće s gornje trake.',
    neverGoogle: 'Odjava s Googlea i brisanje cijele Kune.',
  },
}

export const words = language === 'hr' ? hr : en
