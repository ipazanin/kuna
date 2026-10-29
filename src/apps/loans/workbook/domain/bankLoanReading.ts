import type { BankLoan, InterimInterest, LoanSubsidy } from './bankLoan'
import { BANK_LOAN_RECORDS } from './loanKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, optionalMoney, ownId, positiveMoney, refuse, requiredDate, textOf, wholeNumberOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** Fifty years of monthly instalments, more than any housing loan runs. */
const MOST_INSTALMENTS = 600

function countOf(fields: StoredFields, name: string): number | null {
  if (fields[name] === undefined) return null
  const count = wholeNumberOf(fields[name])
  return count !== null && count >= 1 ? count : refuse(`${name} "${textOf(fields[name])}" is not a whole number above zero`)
}

function interimInterestOf(fields: StoredFields, drawdown: BankLoan['drawdown'], firstInstalment: BankLoan['firstInstalment']): InterimInterest | null {
  const amount = optionalMoney(fields, 'interim_interest')
  const date = optionalDate(fields, 'interim_interest_date')
  if (amount === null && date === null) return null
  if (amount === null || date === null) refuse('interim_interest and interim_interest_date go together, and only one is filled')
  if (amount <= 0) refuse('interim_interest must be more than zero')
  if (date < drawdown || date > firstInstalment) refuse(`interim_interest_date ${date} is not from the drawdown ${drawdown} to the first instalment ${firstInstalment}`)
  return { amount, date }
}

function subsidyOf(fields: StoredFields, instalments: number): LoanSubsidy | null {
  const monthly = optionalMoney(fields, 'subsidy_monthly')
  const firstInstalment = countOf(fields, 'subsidy_first_instalment')
  const count = countOf(fields, 'subsidy_instalments')
  const payer = textOf(fields.subsidy_payer)
  if (monthly === null && firstInstalment === null && count === null) {
    if (payer !== '') refuse('subsidy_payer names a payer of no subsidy')
    return null
  }
  if (monthly === null || firstInstalment === null || count === null) refuse('subsidy_monthly, subsidy_first_instalment and subsidy_instalments go together, and not all are filled')
  if (monthly <= 0) refuse('subsidy_monthly must be more than zero')
  if (firstInstalment + count - 1 > instalments) refuse(`the subsidy runs past instalment ${instalments}, the loan's last`)
  return { monthly, firstInstalment, instalments: count, payer }
}

export function bankLoanOf(fields: StoredFields, id: RecordId | null): BankLoan {
  const name = textOf(fields.name)
  if (name === '') refuse('no name')
  const principal = positiveMoney(fields, 'principal')
  const drawdown = requiredDate(fields, 'drawdown')
  const firstInstalment = requiredDate(fields, 'first_instalment')
  if (firstInstalment <= drawdown) refuse(`first_instalment ${firstInstalment} is not after the drawdown ${drawdown}`)
  const instalments = countOf(fields, 'instalments') ?? refuse('no instalments')
  if (instalments > MOST_INSTALMENTS) refuse(`more than ${MOST_INSTALMENTS} instalments`)
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
