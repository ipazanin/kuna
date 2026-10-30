import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  menu: 'Kuna settings',
  description: "Sync, look and language on this device, for every app. Where an app keeps its books is on that app's Settings.",
  language: {
    legend: 'Language',
    browser: 'Browser language',
    note: "Browser language follows this browser's first language. Changing it loads the app again.",
  },
  appearance: {
    title: 'Appearance and privacy',
    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    themeNote: "System follows this device's setting as it changes. Light or Dark is remembered on this device.",
    privacy: "There is no server. Nothing leaves this browser except calls to Google's APIs for the books on Drive, your statements and your invoices.",
    privacyLink: 'Read the privacy notes',
  },
  sync: {
    title: 'Sync',
    subtitle: 'Each sync reads the books on Drive, then runs every step their settings turn on, in order.',
    auto: 'Sync as the app opens',
    autoNote: 'On this device only. The app syncs as it opens and when you come back to it after ten minutes, while the Google sign-in is good. Off waits for your tap on Sync.',
    signOut: 'Sign out of Google',
    signedOut: 'Signed out of Google',
    signedOutNote: 'The next sync asks Google to sign you in again.',
  },
}

export const hr: Translation<typeof en> = {
  menu: 'Postavke Kune',
  description: 'Sinkronizacija, izgled i jezik na ovom uređaju, za sve aplikacije. Gdje aplikacija čuva svoju datoteku, piše u postavkama te aplikacije.',
  language: {
    legend: 'Jezik',
    browser: 'Jezik preglednika',
    note: 'Jezik preglednika slijedi prvi jezik ovog preglednika. Kad promijenite jezik, aplikacija se ponovno učita.',
  },
  appearance: {
    title: 'Izgled i privatnost',
    theme: 'Tema',
    system: 'Sustav',
    light: 'Svijetla',
    dark: 'Tamna',
    themeNote: 'Sustav prati postavku ovog uređaja kad se promijeni. Svijetla ili Tamna pamti se na ovom uređaju.',
    privacy: 'Nema poslužitelja. Iz ovog preglednika ništa ne odlazi osim poziva Googleovim sučeljima za datoteke na Driveu, vaše izvode i vaše račune.',
    privacyLink: 'Pročitajte napomene o privatnosti',
  },
  sync: {
    title: 'Sinkronizacija',
    subtitle: 'Svaka sinkronizacija čita datoteke na Driveu, a zatim redom pokreće svaki korak koji njihove postavke uključuju.',
    auto: 'Sinkroniziraj pri otvaranju',
    autoNote: 'Samo na ovom uređaju. Aplikacija se sinkronizira kad se otvori i kad joj se vratite nakon deset minuta, dok Google prijava vrijedi. Isključeno čeka da dodirnete „Sinkroniziraj”.',
    signOut: 'Odjava s Googlea',
    signedOut: 'Odjavljeni ste s Googlea',
    signedOutNote: 'Sljedeća sinkronizacija traži od Googlea da vas ponovno prijavi.',
  },
}

export const words = language === 'hr' ? hr : en
