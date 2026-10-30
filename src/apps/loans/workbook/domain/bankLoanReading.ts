import type { BankLoan, InterimInterest, LoanSubsidy } from './bankLoan'
import { BANK_LOAN_RECORDS } from './loanKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
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

export function bankLoanOf(fields: StoredFields, id: RecordId | null): BankLoan {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  const principal = positiveMoney(fields, 'principal')
  const drawdown = requiredDate(fields, 'drawdown')
  const firstInstalment = requiredDate(fields, 'first_instalment')
  if (firstInstalment <= drawdown) refuse(words.firstNotAfterDrawdown(firstInstalment, drawdown))
  const instalments = countOf(fields, 'instalments') ?? refuse(storedWords.reasons.none('instalments', ''))
  if (instalments > MOST_INSTALMENTS) refuse(words.tooManyInstalments(MOST_INSTALMENTS))
  return {
    id: ownId(id),
    name,
    lender: textOf(fields.lender),
    principal,
    drawdown,
    firstInstalment,
    instalments,
    interimInterest: interimInterestOf(fields, drawdown, firstInstalment),
    subsidy: subsidyOf(fields, instalments),
    note: textOf(fields.note),
  }
}

export const BANK_LOAN_CODEC: RecordCodec<BankLoan> = withIdField(
  BANK_LOAN_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  bankLoanOf,
  (loan) =>
    filledFields({
      name: loan.name,
      lender: loan.lender,
      principal: amountText(loan.principal),
      drawdown: loan.drawdown,
      first_instalment: loan.firstInstalment,
      instalments: String(loan.instalments),
      interim_interest: loan.interimInterest === null ? null : amountText(loan.interimInterest.amount),
      interim_interest_date: loan.interimInterest?.date,
      subsidy_monthly: loan.subsidy === null ? null : amountText(loan.subsidy.monthly),
      subsidy_first_instalment: loan.subsidy === null ? null : String(loan.subsidy.firstInstalment),
      subsidy_instalments: loan.subsidy === null ? null : String(loan.subsidy.instalments),
      subsidy_payer: loan.subsidy?.payer,
      note: loan.note,
    }),
)
