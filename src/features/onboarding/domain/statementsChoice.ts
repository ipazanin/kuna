import { civilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { BOOKS_FOLDER } from '../../../shared/text/folderPath'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'
import { mailAddressesOf, mailAddressesProblem, mailSubjectProblem } from '../../mail/domain/mailSource'
import type { Settings } from '../../settings/domain/settings'
import { OTHER_BANK } from './onboardingSteps'
import type { StatementMail, StatementsSource } from './onboardingSteps'

/** The folder the app makes beside the books file for the statements it files from mail, which `drive.file` can then read. */
export const MAIL_STATEMENTS_FOLDER = 'statements'

/** The earliest mail new books propose to read: the first day of this year, so last year's statements stay out of them. */
export function firstMailDay(today: CivilDate): CivilDate {
  return civilDate(Number(today.slice(0, 4)), 1, 1)
}

/** The settings that say how statements reach the app. */
export type StatementSettings = Pick<Settings, 'statementsSync' | 'statementsFolder' | 'statementsMailFrom' | 'statementsMailSubject' | 'mailSince'>

/** The senders and subject words a sync searches for: the preset's, or another bank's as typed. */
function mailTermsOf(mail: StatementMail): { readonly senders: readonly string[]; readonly subject: string } {
  const preset = BANK_PRESETS.find((candidate) => candidate.id === mail.bank)
  return preset ?? { senders: mailAddressesOf(mail.from), subject: mail.subject.trim() }
}

/** Why another bank's typed sender or subject words cannot be searched for, by field. A preset has none. */
export function statementMailProblems(mail: StatementMail): { readonly from?: string; readonly subject?: string } {
  if (mail.bank !== OTHER_BANK) return {}
  const { senders, subject } = mailTermsOf(mail)
  const from = senders.length === 0 ? 'Type the address the bank mails statements from' : mailAddressesProblem(senders)
  const words = subject === '' ? 'Type the words before the statement number' : mailSubjectProblem(subject)
  return { ...(from === null ? {} : { from }), ...(words === null ? {} : { subject: words }) }
}

/**
 * The settings a statements choice writes, each one explicit. By hand switches filing on sync off.
 * A Drive folder switches it on, and the statement step names the folder. Mail switches it on with
 * the folder the app makes beside the books file, the bank's senders and subject words, and the day
 * mail since starts.
 */
export function statementSettingsOf(source: StatementsSource, mail: StatementMail, today: CivilDate): StatementSettings {
  const none = { statementsFolder: [], statementsMailFrom: [], statementsMailSubject: '', mailSince: null }
  switch (source) {
    case 'hand':
      return { ...none, statementsSync: false }
    case 'folder':
      return { ...none, statementsSync: true }
    case 'mail': {
      const { senders, subject } = mailTermsOf(mail)
      return { statementsSync: true, statementsFolder: [BOOKS_FOLDER, MAIL_STATEMENTS_FOLDER], statementsMailFrom: senders, statementsMailSubject: subject, mailSince: mail.since ?? firstMailDay(today) }
    }
  }
}
