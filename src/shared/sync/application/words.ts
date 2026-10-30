import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  books: 'Books',
  /** What the person grants for each scope, as a line or a sentence names it. */
  scopes: {
    'drive.file': 'a Google sign-in',
    'drive.readonly': 'your Drive read access',
    'gmail.readonly': 'your Gmail read access',
    'gmail.compose': 'your Gmail drafts access',
  },
  waitsForSignIn: 'Waits for you to sign in to Google',
  waitsFor: (scopes: string) => `Waits for ${scopes}`,
  skipped: 'Skipped, since the books could not be read',
  waiting: 'Waiting to start',
  reading: 'Reading the file',
  upToDate: 'Up to date',
  notRead: 'The file on Drive could not be read.',
}

export const hr: Translation<typeof en> = {
  books: 'Datoteka',
  scopes: {
    'drive.file': 'prijavu u Google',
    'drive.readonly': 'vaše dopuštenje za čitanje Drivea',
    'gmail.readonly': 'vaše dopuštenje za čitanje Gmaila',
    'gmail.compose': 'vaše dopuštenje za nacrte u Gmailu',
  },
  waitsForSignIn: 'Čeka da se prijavite u Google',
  waitsFor: (scopes) => `Čeka ${scopes}`,
  skipped: 'Preskočeno jer se datoteka nije mogla pročitati',
  waiting: 'Čeka početak',
  reading: 'Čita datoteku',
  upToDate: 'Ažurno',
  notRead: 'Datoteka na Driveu nije se mogla pročitati.',
}

export const words = language === 'hr' ? hr : en
