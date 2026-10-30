import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. The Investments file is datoteka ulaganja.

export const en = {
  noFolder: 'The Investments file has no folder Kuna can see, so it has nowhere to keep the prices file.',
  fakeRevisionsFull: 'The fake Drive keeps no more revisions of the prices file.',
}

export const hr: Translation<typeof en> = {
  noFolder: 'Datoteka ulaganja nema mapu koju Kuna vidi, pa nema gdje čuvati datoteku cijena.',
  fakeRevisionsFull: 'Lažni Drive ne čuva više revizija datoteke cijena.',
}

export const words = language === 'hr' ? hr : en
