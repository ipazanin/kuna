import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. The ECB is ESB in Croatian.

export const en = {
  step: {
    label: 'ECB rates',
    start: 'Asking the ECB for its rates',
    done: (currencies: string) => `The ECB rates of ${currencies} are up to date`,
    unchanged: 'The exchange rates file was already synced in this run',
    failed: 'The ECB rates did not load, so amounts in another currency show in their own currency',
    refused: 'The exchange rates file on Drive is from a newer Kuna or does not read, so the rates stay in this browser',
  },
}

export const hr: Translation<typeof en> = {
  step: {
    label: 'Tečajevi ESB-a',
    start: 'Traže se tečajevi ESB-a',
    done: (currencies) => `Tečajevi ESB-a za ${currencies} su ažurni`,
    unchanged: 'Datoteka tečajeva već je usklađena u ovom usklađivanju',
    failed: 'Tečajevi ESB-a nisu se učitali, pa se iznosi u drugoj valuti prikazuju u svojoj valuti',
    refused: 'Datoteka tečajeva na Driveu je iz novije Kune ili se ne može pročitati, pa tečajevi ostaju u ovom pregledniku',
  },
}

export const words = language === 'hr' ? hr : en
