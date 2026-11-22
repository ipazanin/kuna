import { en as settingsEn, hr as settingsHr } from '../../settings/domain/words'
import { en as settingsScreenEn, hr as settingsScreenHr } from '../../settings/presentation/words'
import { withFullStop } from '../../../../shared/text/withFullStop'
import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'
import { listed } from '../../../../shared/text/translation'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// Mail is pošta and one mail poruka. Filing a statement writes its rows into the ledger, so it is upisati.

export const en = {
  step: {
    label: 'Statement mail',
    seeList: 'See the list',
    accessRanOut: 'The Google access ran out. Sync again.',
    searching: 'Searching Gmail',
    beforeBooks: 'Nothing to search before the books are read',
    stopped: 'The last sync stopped before it finished with the mail. The sync control says what it needs.',
    noAccount: "No account takes the bank's statements yet. Pick them for an account under Accounts.",
    seeAccounts: 'See the accounts',
    stoppedTitle: "Stopped reading the bank's statement mail",
    notStopped: "The bank's statement mail was not turned off",
  },
  card: {
    title: 'Mail',
    subtitle: "Where each sync looks in Gmail for the bank's statements, which it reads and files into the ledger. Nothing is kept on Drive.",
    on: settingsEn.settingLabels.statementsMail,
    onHelp: 'Each sync searches your mail for the sender and subject below. Kuna only reads it, and never marks, moves or files a mail. Off asks Google for no Gmail access.',
    off: 'Off',
    notRead: 'Bank mail is not read.',
    readFrom: (senders: readonly string[], fills: readonly string[]) =>
      fills.length === 0 ? `Bank mail from ${senders.join(', ')}, for no account yet.` : `Bank mail from ${senders.join(', ')}, for ${listInWords(fills)}.`,
    fillsFrom: (account: string, day: string) => `${account} from ${day}`,
    searchedFrom: { newest: 'a week before the day the mail must still reach back to', since: 'the first day the mail fills an account' },
    senders: settingsEn.settingLabels.statementsMailFrom,
    sendersHelp: "Mail addresses, comma separated. Blank leaves the bank's mail unread, and Gmail is not asked for.",
    sendersPlaceholder: 'Not read',
    subject: settingsEn.settingLabels.statementsMailSubject,
    subjectHelp: 'The words before the statement number, such as Izvadak.',
    accounts: 'Accounts it fills',
    accountFrom: (day: string) => `${settingsScreenEn.accounts.columns.startsOn} ${day}`,
    noAccount: "No account takes the bank's statements yet.",
    lastSync: 'What the last sync found',
    syncToRead: 'Sync to read what is new.',
    kinds: { read: 'Read', 'not-read': 'Not read', 'passed-over': 'Passed over' },
    passedOver: 'Only the XML statement is read.',
  },
}

export const hr: Translation<typeof en> = {
  step: {
    label: 'Pošta s izvodima',
    seeList: 'Prikaži popis',
    accessRanOut: 'Googleov pristup je istekao. Sinkronizirajte ponovno.',
    searching: 'Pretražuje Gmail',
    beforeBooks: 'Nema se što pretraživati prije čitanja datoteke',
    stopped: 'Zadnja sinkronizacija zaustavila se prije nego što je završila s poštom. Gumb za sinkronizaciju kaže što joj treba.',
    noAccount: 'Nijedan račun još ne uzima izvode banke. Odaberite ih za račun pod Računi u banci.',
    seeAccounts: 'Pogledaj račune',
    stoppedTitle: 'Pošta banke s izvodima više se ne čita',
    notStopped: 'Pošta banke s izvodima nije isključena',
  },
  card: {
    title: 'Pošta',
    subtitle: 'Gdje svaka sinkronizacija u Gmailu traži izvode banke, koje čita i upisuje u evidenciju. Ništa se ne sprema na Drive.',
    on: settingsHr.settingLabels.statementsMail,
    onHelp:
      'Svaka sinkronizacija u pošti traži pošiljatelja i predmet ispod. Kuna poštu samo čita i nikad je ne označava, ne premješta i ne sprema. Kad je isključeno, od Googlea se ne traži pristup Gmailu.',
    off: 'Isključeno',
    notRead: 'Pošta banke se ne čita.',
    readFrom: (senders, fills) =>
      withFullStop(`Pošta banke ${listed({ one: 's adrese', other: 's adresa' }, senders.length)} ${senders.join(', ')}, ${fills.length === 0 ? 'još ni za jedan račun' : `za ${listInWords(fills)}`}`),
    fillsFrom: (account, day) => `${account} od ${day}`,
    searchedFrom: { newest: 'tjedan dana prije dana do kojega pošta još mora sezati', since: 'prvog dana od kojega pošta puni neki račun' },
    senders: settingsHr.settingLabels.statementsMailFrom,
    sendersHelp: 'Adrese e-pošte, odvojene zarezom. Ako je prazno, pošta banke se ne čita i ne traži se pristup Gmailu.',
    sendersPlaceholder: 'Ne čita se',
    subject: settingsHr.settingLabels.statementsMailSubject,
    subjectHelp: 'Riječi ispred broja izvoda, na primjer Izvadak.',
    accounts: 'Računi koje puni',
    accountFrom: (day) => `${settingsScreenHr.accounts.columns.startsOn} ${day}`,
    noAccount: 'Nijedan račun još ne uzima izvode banke.',
    lastSync: 'Što je pronašla zadnja sinkronizacija',
    syncToRead: 'Sinkronizirajte da se pročita ono što je novo.',
    kinds: { read: 'Pročitano', 'not-read': 'Nije pročitano', 'passed-over': 'Preskočeno' },
    passedOver: 'Čita se samo izvod u XML-u.',
  },
}

export const words = language === 'hr' ? hr : en
