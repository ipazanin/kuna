import { withFullStop } from '../../../../shared/text/withFullStop'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka. Filing an attachment saves it into its Drive folder, so it is spremiti.

export const en = {
  step: {
    label: 'Mail',
    seeList: 'See the list',
    accessRanOut: 'The Google access ran out. Sync again.',
    searching: 'Searching Gmail',
    beforeBooks: 'Nothing to search before the books are read',
    stopped: 'The last sync stopped before it finished with the mail. The sync control says what it needs.',
  },
  card: {
    title: 'Mail',
    subtitle: "Where each sync looks in Gmail for the bank's statements, which it files into the statements folder.",
    notRead: 'Bank mail is not read.',
    readFrom: (senders: readonly string[], since: string) => `Bank mail from ${senders.join(', ')}, since ${since}.`,
    startOfLastYear: 'the start of last year',
    senders: 'The bank mails statements from',
    sendersHelp: "Mail addresses, comma separated. Blank leaves the bank's mail unread, and Gmail is not asked for.",
    sendersPlaceholder: 'Not read',
    subject: 'Subject words',
    subjectHelp: 'The words before the statement number, such as Izvadak.',
    since: 'Mail since',
    sinceHelp:
      'The earliest mail a sync reads. Once a folder holds files, a sync starts a week before the newest one. Blank is the start of last year, so a sync early in January still finds mail from December.',
    lastSync: 'What the last sync found',
  },
  plan: {
    kinds: {
      'not-filed': 'Not filed',
      filed: 'Filed',
      correction: 'Correction',
      unchecked: 'Not compared',
      unmatched: 'Unmatched',
      already: 'Already there',
    },
    searchedFromNewest: (from: string) => `Searched from ${from}, a week before the newest file in its folder`,
    searchedFromSince: (from: string) => `Searched from ${from}, the mail-since day`,
    mail: (subject: string, day: string) => `“${subject}”, ${day}`,
    fromMail: (attachment: string) => `${attachment}, from `,
    correction: 'An older copy has other bytes. The app never replaces a file, so swap it by hand.',
    unchecked: 'An older copy is there, and Drive gives no SHA-256 for it, so the bytes were not compared.',
    noSyncYet: 'No sync on this page has looked at the mail yet. Sync to file what is new.',
    noneOn: 'No kind of mail is on, so the last sync looked at none.',
  },
}

export const hr: Translation<typeof en> = {
  step: {
    label: 'Pošta',
    seeList: 'Prikaži popis',
    accessRanOut: 'Googleov pristup je istekao. Sinkronizirajte ponovno.',
    searching: 'Pretražuje Gmail',
    beforeBooks: 'Nema se što pretraživati prije čitanja datoteke',
    stopped: 'Zadnja sinkronizacija zaustavila se prije nego što je završila s poštom. Gumb za sinkronizaciju kaže što joj treba.',
  },
  card: {
    title: 'Pošta',
    subtitle: 'Gdje svaka sinkronizacija u Gmailu traži izvode banke, koje sprema u mapu izvoda.',
    notRead: 'Pošta banke se ne čita.',
    readFrom: (senders, since) => `Pošta banke ${plural({ one: 's adrese', few: 's adresa', other: 's adresa' }, senders.length)} ${senders.join(', ')}, od ${withFullStop(since)}`,
    startOfLastYear: 'početka prošle godine',
    senders: 'Banka šalje izvode s adresa',
    sendersHelp: 'Adrese e-pošte, odvojene zarezom. Ako je prazno, pošta banke se ne čita i ne traži se pristup Gmailu.',
    sendersPlaceholder: 'Ne čita se',
    subject: 'Riječi u predmetu',
    subjectHelp: 'Riječi ispred broja izvoda, na primjer Izvadak.',
    since: 'Pošta od',
    sinceHelp:
      'Najstarija poruka koju sinkronizacija čita. Kad mapa već ima datoteke, sinkronizacija počinje tjedan dana prije najnovije. Prazno znači početak prošle godine, pa sinkronizacija početkom siječnja i dalje pronalazi poštu iz prosinca.',
    lastSync: 'Što je pronašla zadnja sinkronizacija',
  },
  plan: {
    kinds: {
      'not-filed': 'Nije spremljeno',
      filed: 'Spremljeno',
      correction: 'Ispravak',
      unchecked: 'Nije uspoređeno',
      unmatched: 'Bez pravila',
      already: 'Već postoji',
    },
    searchedFromNewest: (from) => `Pretraženo od ${from}, tjedan dana prije najnovije datoteke u mapi`,
    searchedFromSince: (from) => `Pretraženo od ${from}, dana iz postavke Pošta od`,
    mail: (subject, day) => `„${subject}”, ${day}`,
    fromMail: (attachment) => `${attachment}, iz poruke `,
    correction: 'Starija kopija ima drukčiji sadržaj. Aplikacija nikad ne zamjenjuje datoteku, pa je zamijenite ručno.',
    unchecked: 'Starija kopija postoji, a Drive za nju ne daje SHA-256, pa sadržaj nije uspoređen.',
    noSyncYet: 'Nijedna sinkronizacija na ovoj stranici još nije pregledala poštu. Sinkronizirajte da se spremi ono što je novo.',
    noneOn: 'Nijedna vrsta pošte nije uključena, pa zadnja sinkronizacija nije pregledala nijednu.',
  },
}

export const words = language === 'hr' ? hr : en
