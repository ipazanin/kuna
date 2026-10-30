import type { BankLoan, InterimInterest, LoanSubsidy, LoanTerms } from './bankLoan'
import { BANK_LOAN_RECORDS } from './loanKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { FieldValue } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, optionalMoney, ownId, positiveMoney, refuse, requiredDate, textOf, wholeNumberOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { words } from './words'

/** Fifty years of monthly instalments, more than any housing loan runs. */
const MOST_INSTALMENTS = 600

function countOf(fields: StoredFields, name: string): number | null {
  if (fields[name] === undefined) return null
  const count = wholeNumberOf(fields[name])
  return count !== null && count >= 1 ? count : refuse(words.notACount(name, textOf(fields[name])))
}

function interimInterestOf(fields: StoredFields, drawdown: BankLoan['drawdown'], firstInstalment: BankLoan['firstInstalment']): InterimInterest | null {
  const amount = optionalMoney(fields, 'interim_interest')
  const date = optionalDate(fields, 'interim_interest_date')
  if (amount === null && date === null) return null
  if (amount === null || date === null) refuse(storedWords.reasons.goTogether('interim_interest', 'interim_interest_date'))
  if (amount <= 0) refuse(storedWords.reasons.notAboveZero('interim_interest'))
  if (date < drawdown || date > firstInstalment) refuse(words.interimOutside(date, drawdown, firstInstalment))
  return { amount, date }
}

function subsidyOf(fields: StoredFields, instalments: number): LoanSubsidy | null {
  const monthly = optionalMoney(fields, 'subsidy_monthly')
  const firstInstalment = countOf(fields, 'subsidy_first_instalment')
  const count = countOf(fields, 'subsidy_instalments')
  const payer = textOf(fields.subsidy_payer)
  if (monthly === null && firstInstalment === null && count === null) {
    if (payer !== '') refuse(words.payerWithoutSubsidy)
    return null
  }
  if (monthly === null || firstInstalment === null || count === null) refuse(words.subsidyIncomplete)
  if (monthly <= 0) refuse(storedWords.reasons.notAboveZero('subsidy_monthly'))
  if (firstInstalment + count - 1 > instalments) refuse(words.subsidyPastEnd(instalments))
  return { monthly, firstInstalment, instalments: count, payer }
}

/** The names of the fields the terms are kept in, on a bank loan and on an offer. */
export const LOAN_TERM_FIELDS = [
  'lender',
  'principal',
  'drawdown',
  'first_instalment',
  'instalments',
  'interim_interest',
  'interim_interest_date',
  'subsidy_monthly',
  'subsidy_first_instalment',
  'subsidy_instalments',
  'subsidy_payer',
] as const

/** A number of monthly instalments, from one to fifty years of them. */
export function instalmentsOf(fields: StoredFields, name: string): number {
  const instalments = countOf(fields, name) ?? refuse(storedWords.reasons.none(name, ''))
  return instalments > MOST_INSTALMENTS ? refuse(words.tooManyInstalments(MOST_INSTALMENTS)) : instalments
}

export function loanTermsOf(fields: StoredFields): LoanTerms {
  const principal = positiveMoney(fields, 'principal')
  const drawdown = requiredDate(fields, 'drawdown')
  const firstInstalment = requiredDate(fields, 'first_instalment')
  if (firstInstalment <= drawdown) refuse(words.firstNotAfterDrawdown(firstInstalment, drawdown))
  const instalments = instalmentsOf(fields, 'instalments')
  return {
    lender: textOf(fields.lender),
    principal,
    drawdown,
    firstInstalment,
    instalments,
    interimInterest: interimInterestOf(fields, drawdown, firstInstalment),
    subsidy: subsidyOf(fields, instalments),
  }
}

export function loanTermsFields(terms: LoanTerms): Readonly<Record<(typeof LOAN_TERM_FIELDS)[number], FieldValue | null | undefined>> {
  return {
    lender: terms.lender,
    principal: amountText(terms.principal),
    drawdown: terms.drawdown,
    first_instalment: terms.firstInstalment,
    instalments: String(terms.instalments),
    interim_interest: terms.interimInterest === null ? null : amountText(terms.interimInterest.amount),
    interim_interest_date: terms.interimInterest?.date,
    subsidy_monthly: terms.subsidy === null ? null : amountText(terms.subsidy.monthly),
    subsidy_first_instalment: terms.subsidy === null ? null : String(terms.subsidy.firstInstalment),
    subsidy_instalments: terms.subsidy === null ? null : String(terms.subsidy.instalments),
    subsidy_payer: terms.subsidy?.payer,
  }
}

export function bankLoanOf(fields: StoredFields, id: RecordId | null): BankLoan {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  return { id: ownId(id), name, ...loanTermsOf(fields), note: textOf(fields.note) }
}

export const BANK_LOAN_CODEC: RecordCodec<BankLoan> = withIdField(
  BANK_LOAN_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  bankLoanOf,
  (loan) => filledFields({ name: loan.name, ...loanTermsFields(loan), note: loan.note }),
)
