import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  books: 'Books',
  /** What the person grants for each scope, as a line or a sentence names it. */
  scopes: {
    'drive.file': 'a Google sign-in',
    'drive.readonly': 'your Drive read access',
    'drive.appdata': "your access to the app's hidden folder on Drive",
    'gmail.readonly': 'your Gmail read access',
    'gmail.compose': 'your Gmail drafts access',
    'script.external_request': "your access for the bank sync's script",
  },
  waitsForSignIn: 'Waits for you to sign in to Google',
  waitsFor: (scopes: string) => `Waits for ${scopes}`,
  skipped: 'Skipped, since the books could not be read',
  waiting: 'Waiting to start',
  off: 'Off in Settings',
  reading: 'Reading the file',
  upToDate: 'Up to date',
  notRead: 'The file on Drive could not be read.',
  settings: 'Settings',
}

export const hr: Translation<typeof en> = {
  books: 'Datoteka',
  scopes: {
    'drive.file': 'prijavu u Google',
    'drive.readonly': 'vaše dopuštenje za čitanje Drivea',
    'drive.appdata': 'vaše dopuštenje za skrivenu mapu aplikacije na Driveu',
    'gmail.readonly': 'vaše dopuštenje za čitanje Gmaila',
    'gmail.compose': 'vaše dopuštenje za skice u Gmailu',
    'script.external_request': 'vaše dopuštenje za skriptu sinkronizacije s bankom',
  },
  waitsForSignIn: 'Čeka da se prijavite u Google',
  waitsFor: (scopes) => `Čeka ${scopes}`,
  skipped: 'Preskočeno jer se datoteka nije mogla pročitati',
  waiting: 'Čeka početak',
  off: 'Isključeno u postavkama',
  reading: 'Čita datoteku',
  upToDate: 'Ažurno',
  notRead: 'Datoteka na Driveu nije se mogla pročitati.',
  settings: 'Postavke',
}

export const words = language === 'hr' ? hr : en
