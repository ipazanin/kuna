import { MOVEMENT_KINDS } from './movement'
import type { MovementKind } from './movement'
import { fractionOf, rateOfText, rateText } from '../../bankLoans/domain/yearlyRate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { dayText, labelWords, labelled, numberText } from '../../../../shared/storage/domain/recordCodec'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A field keeps its name as the file stores it, such as first_instalment. English keeps the file's dates, and Croatian writes them its own way.

/** A rate the field reads as a percent, such as `3.18%`, and any other text as it is. */
function percentText(text: string): string {
  const rate = rateOfText(text)
  return rate === null ? text : `${rateText(rate)}%`
}

/** A date field as the day Croatian writes, anything else as its text. */
function dayInWords(field: StoredField | undefined): string {
  const day = field?.date ?? null
  return day === null ? textOf(field) : dayLabel(day)
}

/** An amount field as Croatian writes the money, anything else as its text. */
function moneyInWords(field: StoredField | undefined): string {
  const money = field?.money ?? null
  return money === null ? textOf(field) : formatMoney(money)
}

function isMovementKind(text: string): text is MovementKind {
  return (MOVEMENT_KINDS as readonly string[]).includes(text)
}

export const en = {
  kinds: { borrowed: 'Borrowed', 'borrowed-in-kind': 'Borrowed in kind', repaid: 'Repaid', 'repaid-in-kind': 'Repaid in kind', forgiven: 'Forgiven' },
  /** The words that name a record of each kind, as its stored fields read. */
  labels: {
    movement: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.kind), numberText(fields.amount)]),
    ratePeriod: (fields: StoredFields) => labelWords([percentText(textOf(fields.rate)), labelled('from', dayText(fields.from))]),
    extraPayment: (fields: StoredFields) => labelWords([dayText(fields.date), numberText(fields.amount)]),
    lateInstalment: (fields: StoredFields) => labelWords([labelled('due', dayText(fields.due)), labelled('paid', dayText(fields.paid))]),
  },
  notACount: (name: string, text: string) => `${name} "${text}" is not a whole number above zero`,
  interimOutside: (date: CivilDate, drawdown: CivilDate, firstInstalment: CivilDate) => `interim_interest_date ${date} is not from the drawdown ${drawdown} to the first instalment ${firstInstalment}`,
  payerWithoutSubsidy: 'subsidy_payer names a payer of no subsidy',
  subsidyIncomplete: 'subsidy_monthly, subsidy_first_instalment and subsidy_instalments go together, and not all are filled',
  subsidyPastEnd: (last: number) => `the subsidy runs past instalment ${last}, the loan's last`,
  firstNotAfterDrawdown: (firstInstalment: CivilDate, drawdown: CivilDate) => `first_instalment ${firstInstalment} is not after the drawdown ${drawdown}`,
  tooManyInstalments: (most: number) => `more than ${most} instalments`,
  notARate: (text: string) => `rate "${text}" is not a yearly percent with at most four decimals, such as 3.18`,
  paidNotAfterDue: (paid: CivilDate, due: CivilDate) => `paid ${paid} is not after the due date ${due}`,
  openingBelowZero: 'opening_balance is below zero',
  noBankLoan: 'names no bank loan in the file',
  noInformalLoan: 'names no informal loan in the file',
  notADueDate: (field: 'from' | 'due', date: CivilDate, loan: string) => `${field} ${date} is not a due date of "${loan}"`,
  rateSharesDay: (loan: string, from: CivilDate) => `another rate period of "${loan}" starts on ${from} too`,
  leavesWithoutRate: (from: CivilDate, loan: string, firstInstalment: CivilDate) => `from ${from} leaves the instalments of "${loan}" from ${firstInstalment} without a rate`,
  beforeDrawdown: (date: CivilDate, loan: string, drawdown: CivilDate) => `date ${date} is before "${loan}" was drawn on ${drawdown}`,
  noPlan: (firstInstalment: CivilDate) => `no rate period starts at its first instalment on ${firstInstalment}, so its plan cannot be worked out`,
  lateSharesDue: (loan: string, due: CivilDate) => `another late instalment of "${loan}" names the due date ${due} too`,
  beforeStart: (date: CivilDate, loan: string, start: CivilDate) => `date ${date} is before "${loan}" starts on ${start}`,
}

export const hr: Translation<typeof en> = {
  kinds: { borrowed: 'Posuđeno', 'borrowed-in-kind': 'Posuđeno u naravi', repaid: 'Vraćeno', 'repaid-in-kind': 'Vraćeno u naravi', forgiven: 'Oprošteno' },
  labels: {
    movement: (fields) => {
      const kind = textOf(fields.kind)
      return labelWords([dayInWords(fields.date), isMovementKind(kind) ? hr.kinds[kind].toLowerCase() : kind, moneyInWords(fields.amount)])
    },
    ratePeriod: (fields) => {
      const text = textOf(fields.rate)
      const rate = rateOfText(text)
      return labelWords([[rate === null ? text : formatRate(fractionOf(rate)), labelled('od', dayInWords(fields.from))].filter((part) => part !== '').join(' ')])
    },
    extraPayment: (fields) => labelWords([dayInWords(fields.date), moneyInWords(fields.amount)]),
    lateInstalment: (fields) => labelWords([labelled('dospijeće', dayInWords(fields.due)), labelled('plaćeno', dayInWords(fields.paid))]),
  },
  notACount: (name, text) => `${name} „${text}” nije cijeli broj veći od nule`,
  interimOutside: (date, drawdown, firstInstalment) => `interim_interest_date ${dayLabel(date)} nije između isplate ${dayLabel(drawdown)} i prvog anuiteta ${dayLabel(firstInstalment)}`,
  payerWithoutSubsidy: 'subsidy_payer navodi platitelja, a subvencije nema',
  subsidyIncomplete: 'subsidy_monthly, subsidy_first_instalment i subsidy_instalments idu zajedno, a nisu sva popunjena',
  subsidyPastEnd: (last) => `subvencija traje dulje od ${last}. anuiteta, posljednjeg anuiteta kredita`,
  firstNotAfterDrawdown: (firstInstalment, drawdown) => `first_instalment ${dayLabel(firstInstalment)} nije nakon isplate ${dayLabel(drawdown)}`,
  tooManyInstalments: (most) => `više od ${most} anuiteta`,
  notARate: (text) => `rate „${text}” nije godišnji postotak s najviše četiri decimale, na primjer 3.18`,
  paidNotAfterDue: (paid, due) => `paid ${dayLabel(paid)} nije nakon dospijeća ${dayLabel(due)}`,
  openingBelowZero: 'opening_balance je manji od nule',
  noBankLoan: 'u datoteci nema kredita koji navodi',
  noInformalLoan: 'u datoteci nema pozajmice koju navodi',
  notADueDate: (field, date, loan) => `${field} ${dayLabel(date)} nije dospijeće kredita „${loan}”`,
  rateSharesDay: (loan, from) => `i drugo razdoblje kamatne stope kredita „${loan}” počinje ${dayLabel(from)}`,
  leavesWithoutRate: (from, loan, firstInstalment) => `from ${dayLabel(from)} ostavlja anuitete kredita „${loan}” od ${dayLabel(firstInstalment)} bez kamatne stope`,
  beforeDrawdown: (date, loan, drawdown) => `datum ${dayLabel(date)} je prije isplate kredita „${loan}” ${dayLabel(drawdown)}`,
  noPlan: (firstInstalment) => `nijedno razdoblje kamatne stope ne počinje s prvim anuitetom ${dayLabel(firstInstalment)}, pa se otplatni plan ne može izračunati`,
  lateSharesDue: (loan, due) => `i drugi zakašnjeli anuitet kredita „${loan}” navodi dospijeće ${dayLabel(due)}`,
  beforeStart: (date, loan, start) => `datum ${dayLabel(date)} je prije početka pozajmice „${loan}” ${dayLabel(start)}`,
}

export const words = language === 'hr' ? hr : en
