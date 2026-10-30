import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Loans file is datoteka kredita in Croatian.

export const en = {
  exportFile: 'Export the Loans file',
  nothingToExport: 'There is no Loans file to export yet.',
  exported: 'Exported',
  exportFailed: 'Export failed',
  notOpened: 'The Loans file was not opened',
  alreadyOpen: 'Your Loans file is already open',
  alreadyOpenNote: (name: string) => `${name} on Google Drive is the file on screen, read again just now.`,
  opened: (name: string) => `Opened ${name}`,
  openedNote: (name: string) => `${name} on Google Drive is on screen now, and the app keeps a copy in this browser.`,
}

export const hr: Translation<typeof en> = {
  exportFile: 'Izvezi datoteku kredita',
  nothingToExport: 'Još nema datoteke kredita za izvoz.',
  exported: 'Izvezeno',
  exportFailed: 'Izvoz nije uspio',
  notOpened: 'Datoteka kredita nije otvorena',
  alreadyOpen: 'Datoteka kredita već je otvorena',
  alreadyOpenNote: (name) => `Na zaslonu je ${name} s Google Drivea, upravo ponovno pročitana.`,
  opened: (name) => `Otvorena je datoteka ${name}`,
  openedNote: (name) => `${name} s Google Drivea sada je na zaslonu, a aplikacija čuva kopiju u ovom pregledniku.`,
}

export const words = language === 'hr' ? hr : en
