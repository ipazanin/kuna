import { language } from '../../text/language'
import type { EnglishForms, Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A Croatian date ends in its own full stop.

export const en = {
  notSynced: 'Not synced yet',
  asOfToday: (time: string) => `As of today, ${time}`,
  asOf: (stamp: string) => `As of ${stamp}`,
  problems: (count: number): EnglishForms => ({ one: '1 problem', other: `${count} problems` }),
  /** "Statements need your Drive read access", the steps counted. */
  needs: (_count: number, steps: string, scopes: string): EnglishForms => ({ one: `${steps} needs ${scopes}`, other: `${steps} need ${scopes}` }),
  tapToRetry: (why: string, signIn: boolean) => `${why} Tap ${signIn ? 'Sign in to Google' : 'Allow access'} to try again.`,
  syncing: 'Syncing',
  signIn: 'Sign in to Google',
  allowAccess: 'Allow access',
  sync: 'Sync',
  /** The sync as a thing, over its steps. */
  title: 'Sync',
  syncingStep: (step: string, position: number, of: number, line: string) => `Syncing, ${step}, step ${position} of ${of}: ${line}`,
  signInFirst: 'Sign in to Google, which the sync needs first',
  signInAgain: (why: string) => `Sign in to Google. ${why}`,
  allowAccessBecause: (why: string) => `Allow access. ${why}`,
  problemsInLastSync: (problems: string) => `${problems} in the last sync. Show the steps`,
  syncNotYet: 'Sync. Not synced yet',
  syncedAgo: (age: string, stamp: string) => `Synced ${age}, ${stamp}. Sync now`,
  googleAsks: 'Google asks you to sign in before the sync.',
  lookAt: (_count: number, steps: string): EnglishForms => ({ one: `Look at the ${steps} step`, other: `Look at the ${steps} steps` }),
  lastSyncSteps: 'The steps of the last sync',
  steps: {
    none: 'No sync on this page yet.',
    since: (stamp: string) => `Syncing since ${stamp}`,
    last: (stamp: string) => `Last sync ${stamp}`,
    off: 'Off in Settings',
    undo: 'Undo',
    again: 'Sync again',
  },
}

export const hr: Translation<typeof en> = {
  notSynced: 'Još nije sinkronizirano',
  asOfToday: (time) => `Stanje danas u ${time}`,
  asOf: (stamp) => `Stanje: ${stamp}`,
  problems: (count) => ({ one: `${count} problem`, few: `${count} problema`, other: `${count} problema` }),
  needs: (_count, steps, scopes) => ({ one: `${steps} treba ${scopes}`, few: `${steps} trebaju ${scopes}`, other: `${steps} trebaju ${scopes}` }),
  tapToRetry: (why, signIn) => `${why} Dodirnite „${signIn ? 'Prijava u Google' : 'Dopusti pristup'}” da biste pokušali ponovno.`,
  syncing: 'Sinkronizacija',
  signIn: 'Prijava u Google',
  allowAccess: 'Dopusti pristup',
  sync: 'Sinkroniziraj',
  title: 'Sinkronizacija',
  syncingStep: (step, position, of, line) => `Sinkronizacija, ${step}, korak ${position} od ${of}: ${line}`,
  signInFirst: 'Prijava u Google, potrebna prije sinkronizacije',
  signInAgain: (why) => `Prijava u Google. ${why}`,
  allowAccessBecause: (why) => `Dopusti pristup. ${why}`,
  problemsInLastSync: (problems) => `${problems} u zadnjoj sinkronizaciji. Prikaži korake`,
  syncNotYet: 'Sinkroniziraj. Još nije sinkronizirano',
  syncedAgo: (age, stamp) => `Sinkronizirano ${age}, ${stamp}. Sinkroniziraj sada`,
  googleAsks: 'Google traži da se prijavite prije sinkronizacije.',
  lookAt: (_count, steps) => ({ one: `Pogledajte korak ${steps}`, few: `Pogledajte korake ${steps}`, other: `Pogledajte korake ${steps}` }),
  lastSyncSteps: 'Koraci zadnje sinkronizacije',
  steps: {
    none: 'Na ovoj stranici još nije bilo sinkronizacije.',
    since: (stamp) => `Sinkronizacija od ${stamp}`,
    last: (stamp) => `Zadnja sinkronizacija ${stamp}`,
    off: 'Isključeno u postavkama',
    undo: 'Poništi',
    again: 'Sinkroniziraj ponovno',
  },
}

export const words = language === 'hr' ? hr : en
