import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  menu: 'Kuna settings',
  description: "Sync, the assistant, look and language on this device, for every app. Where an app keeps its books, and what it may send to the assistant, is on that app's Settings.",
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
    privacy:
      "There is no server. Nothing leaves this browser except calls to Google's APIs for the books on Drive, your statements and your invoices, to the price vendors for Investments, and to the AI company of your key, when you use the assistant.",
    privacyLink: 'Read the privacy notes',
  },
  filesHome: {
    title: 'Where new files go',
    onDrive: "New files go in Kuna's folder on Google Drive, with a folder inside it for each app. Your existing files stay where they are. Each app's Settings can move its file.",
    inBrowser: 'New files stay in this browser. Your existing files stay where they are.',
    askAgainNote: 'The next app you set up on this device asks again. Nothing moves.',
    askAgain: 'Ask me again',
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
  keys: {
    title: 'Keys in your Google account',
    subtitle: 'With a file of yours on Drive, each sync keeps your keys in a hidden folder of your Google account. This deletes them from there, also after your last file left Drive.',
    action: 'Delete my keys from my Google account',
    confirmTitle: 'Delete your keys from your Google account?',
    confirmDescription: "This deletes the keys file in Kuna's hidden folder, and any old keys file left by an Investments file. It cannot be undone.",
    stayHere: 'The keys in this browser stay. To stop using a key, remove it on its card too.',
    syncsAgain: 'While a file of yours is on Drive, the next sync saves the keys of this browser to your Google account again, and so does the next sync of any other browser that holds keys.',
    cancel: 'Cancel',
    confirm: 'Delete',
    deleted: 'No Kuna keys are left in your Google account',
    failed: 'The keys were not deleted',
  },
}

export const hr: Translation<typeof en> = {
  menu: 'Postavke Kune',
  description: 'Sinkronizacija, asistent, izgled i jezik na ovom uređaju, za sve aplikacije. Gdje aplikacija čuva svoju datoteku i što smije slati asistentu, piše u postavkama te aplikacije.',
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
    privacy:
      'Nema poslužitelja. Iz ovog preglednika ništa ne odlazi osim poziva Googleovim sučeljima za datoteke na Driveu, vaše izvode i vaše račune, izvorima cijena za Ulaganja i AI tvrtki vašeg ključa kad koristite asistenta.',
    privacyLink: 'Pročitajte napomene o privatnosti',
  },
  filesHome: {
    title: 'Gdje idu nove datoteke',
    onDrive: 'Nove datoteke idu u mapu Kuna na Google Driveu, s mapom za svaku aplikaciju. Postojeće datoteke ostaju gdje jesu. Postavke svake aplikacije mogu premjestiti njezinu datoteku.',
    inBrowser: 'Nove datoteke ostaju u ovom pregledniku. Postojeće datoteke ostaju gdje jesu.',
    askAgainNote: 'Sljedeća aplikacija koju postavite na ovom uređaju ponovno pita. Ništa se ne premješta.',
    askAgain: 'Pitaj me ponovno',
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
  keys: {
    title: 'Ključevi na vašem Google računu',
    subtitle:
      'Dok je neka vaša datoteka na Driveu, svaka sinkronizacija čuva vaše ključeve u skrivenoj mapi vašeg Google računa. Ovo ih odande briše, i nakon što je vaša zadnja datoteka napustila Drive.',
    action: 'Obriši moje ključeve s mog Google računa',
    confirmTitle: 'Obrisati ključeve s vašeg Google računa?',
    confirmDescription: 'Ovo briše datoteku ključeva u skrivenoj mapi Kune i svaku staru datoteku ključeva koju je ostavila datoteka ulaganja. To se ne može poništiti.',
    stayHere: 'Ključevi u ovom pregledniku ostaju. Ako ključ više ne želite koristiti, uklonite ga i na njegovoj kartici.',
    syncsAgain:
      'Dok je neka vaša datoteka na Driveu, sljedeća sinkronizacija ponovno sprema ključeve ovog preglednika na vaš Google račun, a isto čini i sljedeća sinkronizacija svakog drugog preglednika koji čuva ključeve.',
    cancel: 'Odustani',
    confirm: 'Obriši',
    deleted: 'Na vašem Google računu više nema ključeva Kune',
    failed: 'Ključevi nisu obrisani',
  },
}

export const words = language === 'hr' ? hr : en
