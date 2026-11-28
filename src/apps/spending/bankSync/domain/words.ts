import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence.

export const en = {
  /** A linked account Kuna does not keep, by its bank, its currency where it has one, and the end of its number in brackets where given, never the whole IBAN. */
  linkedAccount: (bank: string, currency: string, ending: string) => [bank, currency, ending === '' ? '' : `(ending ${ending})`].filter((part) => part !== '').join(' '),
  sameAccountTwice: (bank: string, account: string) => `${bank} has more than one account that fits ${account}, so none of them was read.`,
  bankFailed: (bank: string, reason: string) => `${bank} did not answer, so its rows wait for a later sync: ${reason}`,
  sessionEnded: (bank: string) => `The link to ${bank} ended early. Link it again.`,
  sessionNotHere: (bank: string) => `This browser does not hold the link to ${bank}. Get it from Google on Settings, Bank sync, or link it again.`,
  noFile: 'The Spending file is not open yet.',
  imported: 'Bank rows imported',
  fetched: 'Banks asked',
  linked: 'Bank linked',
  linkEndedTitle: 'Bank link ended',
  noLinkEnd: (validUntil: string) => `Enable Banking gave the link an end Kuna cannot read: ${validUntil}`,
}

export const hr: Translation<typeof en> = {
  linkedAccount: (bank, currency, ending) => [bank, currency, ending === '' ? '' : `(završava na ${ending})`].filter((part) => part !== '').join(' '),
  sameAccountTwice: (bank, account) => `${bank} ima više računa koji odgovaraju računu ${account}, pa nijedan nije pročitan.`,
  bankFailed: (bank, reason) => `Banka ${bank} nije odgovorila, pa njezini retci čekaju sljedeću sinkronizaciju: ${reason}`,
  sessionEnded: (bank) => `Veza s bankom ${bank} prekinuta je prije roka. Povežite je ponovno.`,
  sessionNotHere: (bank) => `Ovaj preglednik nema vezu s bankom ${bank}. Preuzmite je s Googlea u Postavkama, na kartici Sinkronizacija s bankom, ili je ponovno povežite.`,
  noFile: 'Datoteka potrošnje još nije otvorena.',
  imported: 'Retci iz banke uvezeni',
  fetched: 'Banke pitane',
  linked: 'Banka povezana',
  linkEndedTitle: 'Veza s bankom završena',
  noLinkEnd: (validUntil) => `Enable Banking je vezi dao kraj koji Kuna ne može pročitati: ${validUntil}`,
}

export const words = language === 'hr' ? hr : en
