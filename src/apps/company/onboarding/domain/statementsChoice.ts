import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { BOOKS_FOLDER } from '../../../../shared/text/folderPath'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'
import { mailAddressesFault, mailAddressesOf, mailPhraseFault } from '../../../../shared/mail-filing/domain/mailSource'
import type { MailSearchFault } from '../../../../shared/mail-filing/domain/mailSource'
import type { Settings } from '../../settings/domain/settings'
import { proposedStartDay } from '../../../../shared/app/accountSource'
import { handDaysOf } from '../../workbook/domain/accountIntakes'
import type { Account, CompanyIntake, Transaction } from '../../workbook/domain/workbook'

/** The folder the app makes beside the books file for the statements it files from mail, which `drive.file` can then read. */
export const MAIL_STATEMENTS_FOLDER = 'statements'

/** The bank named for any bank without a preset, whose sender and subject words are typed in. */
export const OTHER_BANK = 'other'

/**
 * The bank's mail statements come from: a preset by its id, or another bank with its sender and
 * subject words as typed, and the day the bank's statements start filling the accounts, null for the first day of this year.
 */
export interface StatementMail {
  readonly bank: string
  readonly from: string
  readonly subject: string
  readonly since: CivilDate | null
}

/** New books take their statements by hand, and delivery is offered after the first one. */
export const STATEMENTS_BY_HAND: Pick<Settings, 'statementsFolder' | 'statementsMailFrom' | 'statementsMailSubject'> = {
  statementsFolder: [],
  statementsMailFrom: [],
  statementsMailSubject: '',
}

/** The day new books propose the bank's statements start filling their accounts: the first day of this year, so last year's statements stay out of them. */
export function firstMailDay(today: CivilDate): CivilDate {
  return civilDate(Number(today.slice(0, 4)), 1, 1)
}

/** The senders and subject words a sync searches for: the preset's, or another bank's as typed. */
function mailTermsOf(mail: StatementMail): { readonly senders: readonly string[]; readonly subject: string } {
  const preset = BANK_PRESETS.find((candidate) => candidate.id === mail.bank)
  return preset ?? { senders: mailAddressesOf(mail.from), subject: mail.subject.trim() }
}

/** Why a typed sender or subject words cannot be searched for: nothing typed, or a fault of what was typed. */
export type StatementMailProblem = 'missing' | MailSearchFault

/** Why another bank's typed sender or subject words cannot be searched for, by field. A preset has none. */
export function statementMailProblems(mail: StatementMail): { readonly from?: StatementMailProblem; readonly subject?: StatementMailProblem } {
  if (mail.bank !== OTHER_BANK) return {}
  const { senders, subject } = mailTermsOf(mail)
  const from = senders.length === 0 ? 'missing' : mailAddressesFault(senders)
  const subjectProblem = subject === '' ? 'missing' : mailPhraseFault('subject', subject)
  return { ...(from === null ? {} : { from }), ...(subjectProblem === null ? {} : { subject: subjectProblem }) }
}

/** The settings rows that file the bank's mail on each sync into the folder the app makes beside the books file. */
export function mailDeliveryRows(mail: StatementMail): readonly { readonly key: string; readonly value: string }[] {
  const { senders, subject } = mailTermsOf(mail)
  return [
    { key: 'statements_folder', value: [BOOKS_FOLDER, MAIL_STATEMENTS_FOLDER].join('/') },
    { key: 'statements_mail_from', value: senders.join(', ') },
    { key: 'statements_mail_subject', value: subject },
  ]
}

/**
 * The accounts kept by hand that the bank's statements fill once they reach the statements folder, each from the day the mail
 * search starts, and never over a day already filed or a row by hand. Only an account with an IBAN, which a statement finds it by.
 */
export function accountsTheStatementsFill(
  accounts: readonly Pick<Account, 'slug' | 'iban' | 'intake'>[],
  ledger: readonly Pick<Transaction, 'account' | 'date' | 'statement' | 'reference'>[],
  since: CivilDate,
  firstOpen: CivilDate | null,
): readonly { readonly slug: string; readonly intake: CompanyIntake }[] {
  return accounts
    .filter((account) => account.intake.rowsFrom === 'by-hand' && account.iban !== '')
    .map((account) => {
      const proposed = proposedStartDay(handDaysOf(account.slug, ledger), since, firstOpen)
      return { slug: account.slug, intake: { rowsFrom: 'mail', startsOn: proposed > since ? proposed : since, alsoFrom: [] } }
    })
}

/** The settings rows that read each sync's statements from a folder at this path from My Drive. */
export function folderDeliveryRows(path: readonly string[]): readonly { readonly key: string; readonly value: string }[] {
  return [{ key: 'statements_folder', value: path.join('/') }]
}
