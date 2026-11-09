import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  purpose: 'Screens that belong to no one app, and the settings of this device that every app follows.',
  on: 'On',
  off: 'Off',
  thisDevice: 'This device',
  foldedCards: 'Folded cards',
  outside: {
    reloads: 'This card has no Undo. Kuna loads again in the new language, and the chat stays.',
    syncs: 'Accept syncs every app whose file is on Drive, through Google and the banks. A bank asked in the last six hours is left alone. What each step writes keeps its Undo on the sync list.',
    syncsBanksNow: 'Accept syncs every app whose file is on Drive, through Google and the banks, and asks every linked bank now. What each step writes keeps its Undo on the sync list.',
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
    noneFolded: 'No card is folded on this device.',
    syncAlone: 'A sync goes on a card of its own. Propose it alone.',
    nothingOnDrive: 'No app keeps its file on Google Drive, so there is nothing to sync.',
    chatWidthRange: (least: number, most: number) => `The chat is between ${least} and ${most} px wide.`,
  },
  settings: {
    theme: 'The look on this device: system, light or dark.',
    language: 'The language on this device: browser, en or hr. Changing it loads Kuna again.',
    autoSync: 'Whether this device syncs as Kuna opens and when it comes back after ten minutes.',
    apps: 'The apps the person said they use. An app left out waits under Other apps on the home until it has a file.',
    filesHome: 'Where new files go, Google Drive or this browser. The chat may only forget the answer, so Kuna asks again.',
    syncNow: 'Sync now, of every app whose file is on Drive, with the banks asked once six hours have passed or at once.',
    foldedCards: 'The cards the person folded on this device. The chat may only open them all.',
    sidebarLayout: 'How the sidebar shows from 1024 px: expanded, icons or hidden. While the chat is open, expanded shows as icons when the window is short of room.',
    chatWidth: 'The chat panel’s width in px on this device, or its default.',
    neverProvider: 'The AI company, its key and its model, and fetching or deleting keys kept in the Google account.',
    neverAnonymise: 'Anonymise for each AI company, and each app’s Send without asking. They guard what the chat sends.',
    neverHistory: 'Clearing the chat history.',
    neverGoogle: 'Signing out of Google, allowing Google access a sync misses, and deleting all of Kuna. Google’s consent window needs the person.',
  },
}

export const hr: Translation<typeof en> = {
  purpose: 'Zasloni koji ne pripadaju nijednoj aplikaciji i postavke ovog uređaja koje prate sve aplikacije.',
  on: 'Uključeno',
  off: 'Isključeno',
  thisDevice: 'Ovaj uređaj',
  foldedCards: 'Sklopljene kartice',
  outside: {
    reloads: 'Ova kartica nema poništavanje. Kuna se ponovno učitava na novom jeziku, a razgovor ostaje.',
    syncs:
      'Prihvati sinkronizira svaku aplikaciju čija je datoteka na Driveu, preko Googlea i banaka. Banka upitana u zadnjih šest sati ostaje na miru. Ono što svaki korak zapiše zadržava poništavanje na popisu sinkronizacije.',
    syncsBanksNow:
      'Prihvati sinkronizira svaku aplikaciju čija je datoteka na Driveu, preko Googlea i banaka, i odmah pita svaku povezanu banku. Ono što svaki korak zapiše zadržava poništavanje na popisu sinkronizacije.',
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
    noneFolded: 'Na ovom uređaju nijedna kartica nije sklopljena.',
    syncAlone: 'Sinkronizacija ide na zasebnu karticu. Predložite je samu.',
    nothingOnDrive: 'Nijedna aplikacija ne drži datoteku na Google Driveu, pa nema što sinkronizirati.',
    chatWidthRange: (least, most) => `Razgovor je širok od ${least} do ${most} px.`,
  },
  settings: {
    theme: 'Izgled na ovom uređaju: „system”, „light” ili „dark”.',
    language: 'Jezik na ovom uređaju: „browser”, „en” ili „hr”. Promjena ponovno učitava Kunu.',
    autoSync: 'Sinkronizira li se ovaj uređaj kad se Kuna otvori i kad joj se vratite nakon deset minuta.',
    apps: 'Aplikacije za koje je osoba rekla da ih koristi. Izostavljena aplikacija čeka pod Ostale aplikacije na početnoj stranici dok ne dobije datoteku.',
    filesHome: 'Gdje idu nove datoteke, Google Drive ili ovaj preglednik. Razgovor smije samo zaboraviti odgovor, pa Kuna ponovno pita.',
    syncNow: 'Sinkroniziraj sada, za svaku aplikaciju čija je datoteka na Driveu, s bankama upitanima nakon šest sati ili odmah.',
    foldedCards: 'Kartice koje je osoba sklopila na ovom uređaju. Razgovor ih smije samo sve otvoriti.',
    sidebarLayout: 'Kako se bočna traka prikazuje od 1024 px: proširena, ikone ili skrivena. Dok je razgovor otvoren, proširena se prikazuje kao ikone kad prozoru nedostaje mjesta.',
    chatWidth: 'Širina ploče razgovora u px na ovom uređaju ili zadana širina.',
    neverProvider: 'AI tvrtka, njezin ključ i model te dohvat ili brisanje ključeva spremljenih na Google računu.',
    neverAnonymise: 'Anonimiziraj za svaku AI tvrtku i Šalji bez pitanja svake aplikacije. Oni čuvaju ono što razgovor šalje.',
    neverHistory: 'Brisanje povijesti razgovora.',
    neverGoogle: 'Odjava s Googlea, dopuštanje Google pristupa koji sinkronizaciji nedostaje i brisanje cijele Kune. Googleov prozor za privolu traži osobu.',
  },
}

export const words = language === 'hr' ? hr : en
