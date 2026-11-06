import { language } from '../../shared/text/language'
import type { Translation } from '../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  description: 'Each app keeps its own books, and one sync keeps them all up to date.',
  setUp: 'Set up',
  next: (line: string) => `Next: ${line}`,
  failed: 'The books did not open. Open the app to see why.',
  otherApps: 'Other apps',
  welcome: {
    title: 'Welcome to Kuna',
    subtitle: 'Two questions, once. Every app is still there if you leave it out, and Kuna settings can ask again about where new files go.',
    which: 'Which apps do you want to use?',
    where: 'Where should your files live?',
    drive: 'One Kuna folder on Google Drive',
    driveNote: 'A folder inside it for each app. Open them on your phone and computer. Backed up daily.',
    browser: 'Only this browser',
    browserNote: 'No Google. One device. Export to keep a copy.',
    continue: 'Continue',
  },
}

export const hr: Translation<typeof en> = {
  description: 'Svaka aplikacija ima svoju datoteku, a jedna sinkronizacija ažurira sve.',
  setUp: 'Postavi',
  next: (line) => `Sljedeće: ${line}`,
  failed: 'Datoteka se nije otvorila. Otvorite aplikaciju da vidite zašto.',
  otherApps: 'Ostale aplikacije',
  welcome: {
    title: 'Dobrodošli u Kunu',
    subtitle: 'Dva pitanja, jednom. Svaka aplikacija ostaje dostupna i ako je izostavite, a postavke Kune mogu ponovno pitati gdje idu nove datoteke.',
    which: 'Koje aplikacije želite koristiti?',
    where: 'Gdje će biti vaše datoteke?',
    drive: 'Jedna mapa Kuna na Google Driveu',
    driveNote: 'U njoj mapa za svaku aplikaciju. Otvarate ih na mobitelu i računalu. Sigurnosna kopija svaki dan.',
    browser: 'Samo ovaj preglednik',
    browserNote: 'Bez Googlea. Jedan uređaj. Izvezite da sačuvate kopiju.',
    continue: 'Nastavi',
  },
}

export const words = language === 'hr' ? hr : en
