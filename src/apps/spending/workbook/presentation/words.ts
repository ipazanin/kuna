import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// The Spending file is datoteka potrošnje in Croatian.

export const en = {
  exportFile: 'Export the Spending file',
  nothingToExport: 'There is no Spending file to export yet.',
  exported: 'Exported',
  exportFailed: 'Export failed',
  notOpened: 'The Spending file was not opened',
  alreadyOpen: 'Your Spending file is already open',
  alreadyOpenNote: (name: string) => `${name} on Google Drive is the file on screen, read again just now.`,
  opened: (name: string) => `Opened ${name}`,
  openedNote: (name: string) => `${name} on Google Drive is on screen now, and the app keeps a copy in this browser.`,
}

export const hr: Translation<typeof en> = {
  exportFile: 'Izvezi datoteku potrošnje',
  nothingToExport: 'Još nema datoteke potrošnje za izvoz.',
  exported: 'Izvezeno',
  exportFailed: 'Izvoz nije uspio',
  notOpened: 'Datoteka potrošnje nije otvorena',
  alreadyOpen: 'Datoteka potrošnje već je otvorena',
  alreadyOpenNote: (name) => `Na zaslonu je „${name}” s Google Drivea, upravo ponovno pročitana.`,
  opened: (name) => `Otvorena je datoteka „${name}”`,
  openedNote: (name) => `„${name}” s Google Drivea sada je na zaslonu, a aplikacija čuva kopiju u ovom pregledniku.`,
}

export const words = language === 'hr' ? hr : en
