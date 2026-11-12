import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { LinkState, LinkTarget } from '../domain/linkTarget'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian names the app Krediti, plural, so it takes plural verbs. A rate is rata, and an informal loan pozajmica.

export const en = {
  instalment: (loan: string, due: CivilDate) => `${loan}, instalment due ${dayLabel(due)}`,
  informalLoan: (name: string) => `${name}, informal loan`,
  gone: 'No longer in Loans',
  opening: 'Linked to Loans, which is still opening',
  failed: 'Linked to Loans, which did not open',
  notSetUp: 'Linked to Loans, which is not set up on this device',
  label: 'Linked to',
  open: 'Open in Loans',
  remove: 'Remove link',
  removed: 'Link removed',
}

export const hr: Translation<typeof en> = {
  instalment: (loan, due) => `${loan}, rata s dospijećem ${dayLabel(due)}`,
  informalLoan: (name) => `${name}, pozajmica`,
  gone: 'Više nije u Kreditima',
  opening: 'Povezano s Kreditima, koji se još otvaraju',
  failed: 'Povezano s Kreditima, koji se nisu otvorili',
  notSetUp: 'Povezano s Kreditima, koji na ovom uređaju nisu postavljeni',
  label: 'Povezano s',
  open: 'Otvori u Kreditima',
  remove: 'Ukloni poveznicu',
  removed: 'Poveznica uklonjena',
}

export const words = language === 'hr' ? hr : en

/** What a row's link reads as: the record it names, or why that record is not shown. */
export function linkText(read: LinkState<LinkTarget>): string {
  if (read.state === 'there') return read.target.kind === 'instalment' ? words.instalment(read.target.loanName, read.target.due) : words.informalLoan(read.target.name)
  return { opening: words.opening, failed: words.failed, 'not-set-up': words.notSetUp, gone: words.gone }[read.state]
}
