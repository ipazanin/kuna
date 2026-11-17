import { en as settingsEn, hr as settingsHr } from '../../settings/domain/words'
import { en as settingsScreenEn, hr as settingsScreenHr } from '../../settings/presentation/words'
import { withFullStop } from '../../../../shared/text/withFullStop'
import { language } from '../../../../shared/text/language'
import { listInWords } from '../../../../shared/text/listInWords'
import { listed } from '../../../../shared/text/translation'
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
    noAccount: "No account takes the bank's statements yet. Pick them for an account under Accounts.",
    seeAccounts: 'See the accounts',
  },
  card: {
    title: 'Mail',
    subtitle: "Where each sync looks in Gmail for the bank's statements, which it files into the statements folder.",
    notRead: 'Bank mail is not read.',
    readFrom: (senders: readonly string[], fills: readonly string[]) =>
      fills.length === 0 ? `Bank mail from ${senders.join(', ')}, for no account yet.` : `Bank mail from ${senders.join(', ')}, for ${listInWords(fills)}.`,
    fillsFrom: (account: string, day: string) => `${account} from ${day}`,
    searchedFrom: { newest: 'a week before the newest file in its folder', since: 'the earliest start day of the accounts it fills' },
    senders: settingsEn.settingLabels.statementsMailFrom,
    sendersHelp: "Mail addresses, comma separated. Blank leaves the bank's mail unread, and Gmail is not asked for.",
    sendersPlaceholder: 'Not read',
    subject: settingsEn.settingLabels.statementsMailSubject,
    subjectHelp: 'The words before the statement number, such as Izvadak.',
    accounts: 'Accounts it fills',
    accountFrom: (day: string) => `${settingsScreenEn.accounts.columns.startsOn} ${day}`,
    noAccount: "No account takes the bank's statements yet.",
    lastSync: 'What the last sync found',
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
    noAccount: 'Nijedan račun još ne uzima izvode banke. Odaberite ih za račun pod Računi u banci.',
    seeAccounts: 'Pogledaj račune',
  },
  card: {
    title: 'Pošta',
    subtitle: 'Gdje svaka sinkronizacija u Gmailu traži izvode banke, koje sprema u mapu izvoda.',
    notRead: 'Pošta banke se ne čita.',
    readFrom: (senders, fills) =>
      withFullStop(`Pošta banke ${listed({ one: 's adrese', other: 's adresa' }, senders.length)} ${senders.join(', ')}, ${fills.length === 0 ? 'još ni za jedan račun' : `za ${listInWords(fills)}`}`),
    fillsFrom: (account, day) => `${account} od ${day}`,
    searchedFrom: { newest: 'tjedan dana prije najnovije datoteke u mapi', since: 'najranijeg početnog dana računa koje puni' },
    senders: settingsHr.settingLabels.statementsMailFrom,
    sendersHelp: 'Adrese e-pošte, odvojene zarezom. Ako je prazno, pošta banke se ne čita i ne traži se pristup Gmailu.',
    sendersPlaceholder: 'Ne čita se',
    subject: settingsHr.settingLabels.statementsMailSubject,
    subjectHelp: 'Riječi ispred broja izvoda, na primjer Izvadak.',
    accounts: 'Računi koje puni',
    accountFrom: (day) => `${settingsScreenHr.accounts.columns.startsOn} ${day}`,
    noAccount: 'Nijedan račun još ne uzima izvode banke.',
    lastSync: 'Što je pronašla zadnja sinkronizacija',
  },
}

export const words = language === 'hr' ? hr : en
