import { language } from '../../text/language'
import type { Translation } from '../../text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  noScript: 'This build of Kuna has no bank sync script, so it cannot link a bank.',
  noKeyHere: 'This browser does not hold your Enable Banking key yet. Get it from Google, or bring the key again.',
}

export const hr: Translation<typeof en> = {
  noScript: 'Ova inačica Kune nema skriptu za sinkronizaciju s bankom, pa ne može povezati banku.',
  noKeyHere: 'Ovaj preglednik još nema vaš ključ za Enable Banking. Preuzmite ga s Googlea ili ponovno donesite ključ.',
}

export const words = language === 'hr' ? hr : en
