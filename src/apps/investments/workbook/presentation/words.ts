import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Investments file is datoteka ulaganja in Croatian.

export const en = {
  exportFile: 'Export the Investments file',
  nothingToExport: 'There is no Investments file to export yet.',
  exported: 'Exported',
  exportFailed: 'Export failed',
  notOpened: 'The Investments file was not opened',
  alreadyOpen: 'Your Investments file is already open',
  alreadyOpenNote: (name: string) => `${name} on Google Drive is the file on screen, read again just now.`,
  opened: (name: string) => `Opened ${name}`,
  openedNote: (name: string) => `${name} on Google Drive is on screen now, and the app keeps a copy in this browser.`,
}

export const hr: Translation<typeof en> = {
  exportFile: 'Izvezi datoteku ulaganja',
  nothingToExport: 'Još nema datoteke ulaganja za izvoz.',
  exported: 'Izvezeno',
  exportFailed: 'Izvoz nije uspio',
  notOpened: 'Datoteka ulaganja nije otvorena',
  alreadyOpen: 'Datoteka ulaganja već je otvorena',
  alreadyOpenNote: (name) => `Na zaslonu je ${name} s Google Drivea, upravo ponovno pročitana.`,
  opened: (name) => `Otvorena je datoteka ${name}`,
  openedNote: (name) => `${name} s Google Drivea sada je na zaslonu, a aplikacija čuva kopiju u ovom pregledniku.`,
}

export const words = language === 'hr' ? hr : en
