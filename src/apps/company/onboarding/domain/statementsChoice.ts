import { civilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'
import { mailAddressesFault, mailAddressesOf, mailPhraseFault } from '../../../../shared/mail/domain/mailSource'
import type { MailSearchFault } from '../../../../shared/mail/domain/mailSource'
import { STATEMENTS_MAIL_KEY, flagText } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import { periodsFrom, proposedStartDay } from '../../../../shared/app/accountSource'
import type { Account, CompanyPeriod, Transaction } from '../../workbook/domain/workbook'

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
export const STATEMENTS_BY_HAND: Pick<Settings, 'statementsMailFrom' | 'statementsMailSubject'> = {
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

/** The settings rows that read the bank's statement mail on each sync, its switch turned on with them. */
export function mailDeliveryRows(mail: StatementMail): readonly { readonly key: string; readonly value: string }[] {
  const { senders, subject } = mailTermsOf(mail)
  return [
    { key: STATEMENTS_MAIL_KEY, value: flagText(true) },
    { key: 'statements_mail_from', value: senders.join(', ') },
    { key: 'statements_mail_subject', value: subject },
  ]
}

/**
 * The accounts kept by hand that the bank's statement mail fills, each from the day the mail search starts, and never over a day
 * already filed or a row already on it, which the mail would not take. Only an account with an IBAN, which a statement finds it by.
 */
export function accountsTheStatementsFill(
  accounts: readonly Pick<Account, 'slug' | 'iban' | 'sources'>[],
  ledger: readonly Pick<Transaction, 'account' | 'date'>[],
  since: CivilDate,
  firstOpen: CivilDate | null,
): readonly { readonly slug: string; readonly sources: readonly CompanyPeriod[] }[] {
  return accounts
    .filter((account) => account.sources.every((period) => period.source === 'by-hand') && account.iban !== '')
    .map((account) => {
      const days = ledger.filter((row) => row.account === account.slug).map((row) => row.date)
      const proposed = proposedStartDay(days, since, firstOpen)
      return { slug: account.slug, sources: periodsFrom(account.sources, 'mail', proposed > since ? proposed : since) }
    })
}
