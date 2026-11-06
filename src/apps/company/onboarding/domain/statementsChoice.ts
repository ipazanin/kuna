import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { BOOKS_FOLDER } from '../../../../shared/text/folderPath'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'
import { mailAddressesOf, mailAddressesProblem, mailSubjectProblem } from '../../../../shared/mail-filing/domain/mailSource'
import type { Settings } from '../../settings/domain/settings'
import { words } from './words'

/** The folder the app makes beside the books file for the statements it files from mail, which `drive.file` can then read. */
export const MAIL_STATEMENTS_FOLDER = 'statements'

/** The bank named for any bank without a preset, whose sender and subject words are typed in. */
export const OTHER_BANK = 'other'

/**
 * The bank's mail statements come from: a preset by its id, or another bank with its sender and
 * subject words as typed, and the earliest day a sync reads, null for the first day of this year.
 */
export interface StatementMail {
  readonly bank: string
  readonly from: string
  readonly subject: string
  readonly since: CivilDate | null
}

/** New books take their statements by hand, and delivery is offered after the first one. */
export const STATEMENTS_BY_HAND: Pick<Settings, 'statementsSync' | 'statementsFolder' | 'statementsMailFrom' | 'statementsMailSubject' | 'mailSince'> = {
  statementsSync: false,
  statementsFolder: [],
  statementsMailFrom: [],
  statementsMailSubject: '',
  mailSince: null,
}

/** The earliest mail new books propose to read: the first day of this year, so last year's statements stay out of them. */
export function firstMailDay(today: CivilDate): CivilDate {
  return civilDate(Number(today.slice(0, 4)), 1, 1)
}

/** The senders and subject words a sync searches for: the preset's, or another bank's as typed. */
function mailTermsOf(mail: StatementMail): { readonly senders: readonly string[]; readonly subject: string } {
  const preset = BANK_PRESETS.find((candidate) => candidate.id === mail.bank)
  return preset ?? { senders: mailAddressesOf(mail.from), subject: mail.subject.trim() }
}

/** Why another bank's typed sender or subject words cannot be searched for, by field. A preset has none. */
export function statementMailProblems(mail: StatementMail): { readonly from?: string; readonly subject?: string } {
  if (mail.bank !== OTHER_BANK) return {}
  const { senders, subject } = mailTermsOf(mail)
  const from = senders.length === 0 ? words.typeSender : mailAddressesProblem(senders)
  const subjectWords = subject === '' ? words.typeSubject : mailSubjectProblem(subject)
  return { ...(from === null ? {} : { from }), ...(subjectWords === null ? {} : { subject: subjectWords }) }
}

/** The settings rows that file the bank's mail on each sync into the folder the app makes beside the books file. */
export function mailDeliveryRows(mail: StatementMail, today: CivilDate): readonly { readonly key: string; readonly value: string }[] {
  const { senders, subject } = mailTermsOf(mail)
  return [
    { key: 'statements_sync', value: 'true' },
    { key: 'statements_folder', value: [BOOKS_FOLDER, MAIL_STATEMENTS_FOLDER].join('/') },
    { key: 'statements_mail_from', value: senders.join(', ') },
    { key: 'statements_mail_subject', value: subject },
    { key: 'mail_since', value: mail.since ?? firstMailDay(today) },
  ]
}

/** The settings rows that read each sync's statements from a folder at this path from My Drive. */
export function folderDeliveryRows(path: readonly string[]): readonly { readonly key: string; readonly value: string }[] {
  return [
    { key: 'statements_sync', value: 'true' },
    { key: 'statements_folder', value: path.join('/') },
  ]
}
