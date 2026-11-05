import { language } from '../../text/language'
import type { Translation } from '../../text/translation'
import type { SecretsFileRefusal } from '../domain/secretsFile'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.

export const en = {
  keyRow: {
    placeholder: 'Paste your key',
    keptEnding: (ending: string) => `A key ending in ${ending} is kept in this browser.`,
    kept: 'A key is kept in this browser.',
    noKey: 'No key in this browser.',
    save: 'Save',
    forget: 'Remove',
    test: 'Test',
    works: 'The key works.',
  },
  step: {
    label: 'Keys',
    reading: 'Reading the keys in your Google account',
    unchanged: 'Up to date',
    sent: "Saved this browser's keys to your Google account",
    received: 'Took the changes another browser saved',
    settings: 'Kuna settings',
  },
  refused: {
    'not-keys': 'A keys file in your Google account is not one Kuna can read, so Kuna left it as it is. Delete my keys from my Google account, in Kuna settings, clears it.',
    newer: 'A newer version of Kuna wrote the keys file. Reload Kuna to read it.',
  } satisfies Record<SecretsFileRefusal, string>,
}

export const hr: Translation<typeof en> = {
  keyRow: {
    placeholder: 'Zalijepite ključ',
    keptEnding: (ending) => `U ovom pregledniku čuva se ključ koji završava na ${ending}.`,
    kept: 'U ovom pregledniku čuva se ključ.',
    noKey: 'U ovom pregledniku nema ključa.',
    save: 'Spremi',
    forget: 'Ukloni',
    test: 'Provjeri',
    works: 'Ključ radi.',
  },
  step: {
    label: 'Ključevi',
    reading: 'Čitanje ključeva s vašeg Google računa',
    unchanged: 'Ažurno',
    sent: 'Ključevi ovog preglednika spremljeni su na vaš Google račun',
    received: 'Preuzete su promjene spremljene u drugom pregledniku',
    settings: 'Postavke Kune',
  },
  refused: {
    'not-keys':
      'Datoteku ključeva na vašem Google računu Kuna ne može pročitati, pa ju je ostavila kakva jest. Možete je ukloniti radnjom „Obriši moje ključeve s mog Google računa” u postavkama Kune.',
    newer: 'Datoteku ključeva zapisala je novija Kuna. Ponovno učitajte Kunu da je pročitate.',
  },
}

export const words = language === 'hr' ? hr : en
