import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import { newestBookingOf } from '../../../../workbook/domain/workbook'
import type { HrDooWorkbook } from '../hrDooPart'
import { civilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { negateMoney } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleId } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { AccrualAdjustment, AdjustmentId } from '../accrual/accrualAdjustment'
import { withDrill } from '../accrual/accrualAdjustment'
import { bookingFigure } from '../accrual/accrualBookings'
import type { AccrualYear } from '../accrual/accrualYear'
import { loanBenefit } from '../ownerLoanInterest'
import type { LoanBenefit } from '../ownerLoanInterest'
import { ownerLoans } from '../ownerLoans'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { atRate, percentText, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

/**
 * `judgement` is an accountant's choice the ledger cannot show. `unexplained` is a gap to the
 * accountant's profit nothing explains. `completeness` asks whether the workbook holds everything,
 * and `compliance` lists what the year's transactions call for beyond the figures.
 */
export type OpenItemGroup = 'judgement' | 'unexplained' | 'completeness' | 'compliance'

export interface YearEndOpenItem {
  readonly key: string
  readonly group: OpenItemGroup
  /** When `on` is set, the title leads up to that day. */
  readonly title: string
  /** The day a screen writes after the title in its own date format. Null when the title names no day. */
  readonly on: CivilDate | null
  readonly settledBy: string
  /** The figure the item is about, with the rows behind it. */
  readonly figure: TracedFigure | null
  readonly rules: readonly RuleId[]
  /** True for a completeness check the workbook already answers. Its `settledBy` then says what would reopen it. */
  readonly settled: boolean
}

type JudgementId = Extract<
  AdjustmentId,
  'grant-schedule' | 'arrears-cut-off' | 'representation-as-booked' | 'cost-placement' | 'receivable-placement' | 'liability-placement'
>

const JUDGEMENTS: Readonly<Record<JudgementId, { readonly settledBy: string; readonly rules: readonly RuleId[] }>> = {
  'grant-schedule': {
    settledBy: "The accountant's release schedule for the grant. Until the grants tab's policy reproduces it, the year-end line stands in for ours.",
    rules: ['hr.acc.grant-recognition'],
  },
  'arrears-cut-off': {
    settledBy: 'The accountant confirms these payments stay in the month they were paid. Otherwise they belong to the month worked.',
    rules: ['hr.acc.accrual-basis'],
  },
  'representation-as-booked': {
    settledBy: 'The exchange rate the accountant booked each card payment at, which the bank amount cannot show.',
    rules: ['hr.cit.representation-add-back'],
  },
  'cost-placement': {
    settledBy: 'Konto rows that name the categories, so later years put each cost on the accountant’s line.',
    rules: [],
  },
  'receivable-placement': {
    settledBy: 'The accountant’s split of the receivables, to compare with ours line by line.',
    rules: [],
  },
  'liability-placement': {
    settledBy: 'The accountant’s split of the liabilities, such as what the notes call deferred income.',
    rules: [],
  },
}

/**
 * What the Accountant tab of Year lists beside the comparison: the accountant's choices the figures rest
 * on, any gap nothing explains, whether the workbook holds everything for the year, and what the
 * year's loans and purchases call for. Each says what would settle it.
 */
export function yearEndOpenItems(workbook: HrDooWorkbook, accrual: AccrualYear, rules: RuleSource = ruleValue): YearEndOpenItem[] {
  return [...judgementItems(accrual), ...unexplainedItems(accrual), ...completenessItems(accrual), ...complianceItems(workbook, accrual, rules)]
}

function judgementItems(accrual: AccrualYear): YearEndOpenItem[] {
  return accrual.adjustments.flatMap((adjustment): YearEndOpenItem[] => {
    if (adjustment.kind !== 'judgement' || !(adjustment.id in JUDGEMENTS)) {
      return []
    }
    const wording = JUDGEMENTS[adjustment.id as JudgementId]
    // A placement moves amounts between lines and adds up to nothing, so it has no figure of its own.
    const figure = adjustment.effect === 'placement' ? null : adjustment.figure
    return [{ key: adjustment.id, group: 'judgement', title: adjustment.figure.label, on: adjustment.figure.on, settledBy: wording.settledBy, figure, rules: wording.rules, settled: false }]
  })
}

function unexplainedItems(accrual: AccrualYear): YearEndOpenItem[] {
  const gaps: (readonly [AccrualAdjustment | null, string])[] = [
    [accrual.bridge.unexplainedBeforeTax, 'Profit before tax differs from the accountant’s'],
    [accrual.bridge.unexplainedAfterTax, 'Profit after tax differs from the accountant’s'],
  ]
  return gaps.flatMap(([gap, title]): YearEndOpenItem[] =>
    gap === null
      ? []
      : [
          {
            key: gap.id,
            group: 'unexplained',
            title,
            on: null,
            settledBy: 'Find the rows behind it: the lines and konto groups that differ point to the categories, and a missing role or vat treatment is the usual cause.',
            figure: gap.figure,
            rules: [],
            settled: false,
          },
        ],
  )
}

function completenessItems(accrual: AccrualYear): YearEndOpenItem[] {
  const months = accrual.uninvoicedMonths.map(
    (entry): YearEndOpenItem => ({
      key: `uninvoiced-${entry.month}`,
      group: 'completeness',
      title: `No invoice delivers work in ${monthLabel(entry.month)}, while invoice ${entry.nextInvoice.number} came after it`,
      on: null,
      settledBy: `An invoice for the month, a delivery period on invoice ${entry.nextInvoice.number} that covers it, or the accountant’s word that no work was delivered.`,
      figure: null,
      rules: ['hr.acc.accrual-basis'],
      settled: false,
    }),
  )
  const purchases = accrual.purchasesWithoutAsset.map(
    (purchase, index): YearEndOpenItem => ({
      key: `no-asset-${index}`,
      group: 'completeness',
      title: `A purchase above the asset threshold with no asset row: ${purchase.label} on`,
      on: purchase.paidOn,
      settledBy: 'An asset row on the assets tab, so it is depreciated, or the accountant’s word that it is a cost of the year.',
      figure: purchase.cost,
      rules: ['hr.cit.asset-threshold', 'hr.acc.capitalisation'],
      settled: false,
    }),
  )
  const everyMonth: YearEndOpenItem = {
    key: 'invoiced',
    group: 'completeness',
    title: 'Every month up to the last invoice has an invoice that delivers in it',
    on: null,
    settledBy: 'work was delivered in the year that no invoice names yet.',
    figure: null,
    rules: ['hr.acc.accrual-basis'],
    settled: true,
  }
  return [...(months.length === 0 ? [everyMonth] : months), ...purchases]
}

function complianceItems(workbook: HrDooWorkbook, accrual: AccrualYear, rules: RuleSource): YearEndOpenItem[] {
  const { year } = accrual
  const firstDay = civilDate(year, 1, 1)
  const lastDay = civilDate(year, 12, 31)
  const loans = ownerLoans(workbook.transactions, workbook.categories).loans.filter(
    (loan) => loan.amount > 0 && loan.lentOn <= lastDay && (loan.repaidOn === null || loan.repaidOn >= firstDay),
  )
  const loanItems: YearEndOpenItem[] = []
  if (loans.length > 0) {
    const lent = withDrill(
      summed('Loans to the owner open during the year', loans.map((loan) => withDrill({ ...tracedFigure('Lent on', loan.amount, 'ledger', []), on: loan.lentOn }, loan.drill)), 'ledger'),
      drillToTransactions({
        period: { preset: 'year', year },
        categories: [...categoriesWithRole(workbook.categories, PACK_ROLES.ownerLoanOut), ...categoriesWithRole(workbook.categories, PACK_ROLES.ownerLoanRepaid)],
      }),
    )
    const report = rules('hr.cit.related-party-report', firstDay).value.reportForm.text
    // Owner shows a year's benefit up to the newest booking, so a year the ledger has not finished counts the same days here.
    const newest = newestBookingOf(workbook.transactions)
    const benefit = loanBenefit(workbook, year, newest !== null && newest < lastDay ? newest : lastDay, rules)
    loanItems.push(
      ...(benefit === null ? [] : [loanBenefitItem(benefit)]),
      {
        key: 'related-party-report',
        group: 'compliance',
        title: `The ${report} report with the profit tax return for ${year}`,
        on: null,
        settledBy: `The ${report} form filed with the return, listing the loans and any lease from the owner.`,
        figure: lent,
        rules: ['hr.cit.related-party-report'],
        settled: false,
      },
      {
        key: 'sole-member-deals',
        group: 'compliance',
        title: 'Each loan between the owner and the company in writing',
        on: null,
        settledBy: 'A loan contract, or a record of each loan, signed by the owner as member and director.',
        figure: lent,
        rules: ['hr.ztd.sole-member-deals'],
        settled: false,
      },
    )
  }
  return [...loanItems, ...assetDecisionItems(workbook, accrual, rules)]
}

/** What the loans give as a benefit in kind, or that they carry enough interest to give none. */
function loanBenefitItem(benefit: LoanBenefit): YearEndOpenItem {
  const prescribed = percentText(benefit.prescribed)
  const carried = percentText(benefit.carried)
  if (benefit.carried >= benefit.prescribed) {
    return {
      key: 'loan-benefit',
      group: 'compliance',
      title: `Loans to the owner carry ${carried}, at least the ${prescribed} a year the income tax law sets`,
      on: null,
      settledBy: `the loans carry less than ${prescribed} a year, as hr_owner_loan_interest says.`,
      figure: null,
      rules: ['hr.pit.loan-benefit'],
      settled: true,
    }
  }
  return {
    key: 'loan-benefit',
    group: 'compliance',
    title: `Benefit in kind on loans to the owner at ${carried}, below ${prescribed} a year`,
    on: null,
    settledBy: `The accountant confirms the benefit was taxed through payroll as pay in kind, or the loans carry ${prescribed} a year.`,
    figure: benefit.figure,
    rules: ['hr.pit.loan-benefit'],
    settled: false,
  }
}

/** Purchases kept as assets within the years after registration whose price is above the share of the capital that needs the members' decision. */
function assetDecisionItems(workbook: HrDooWorkbook, accrual: AccrualYear, rules: RuleSource): YearEndOpenItem[] {
  const registered = workbook.companyFacts.companyRegistered
  if (registered === null) {
    return []
  }
  const decision = rules('hr.ztd.asset-purchase-decision', registered).value
  const years = decision.windowYearsFromRegistration.count
  // Compared as text, so an anniversary on 29 February needs no calendar day of its own.
  const anniversary = `${yearOf(registered) + years}${registered.slice(4)}`
  const capitalLine = workbook.yearEndLines.find((line) => line.year === accrual.year && line.statement === 'balance' && line.line === 'share-capital')
  const capital = capitalLine?.figure.kind === 'money' ? capitalLine.figure.amount : rules('hr.ztd.min-share-capital', registered).value.minimumShareCapital.cents
  const above = atRate(capital, decision.priceShareOfCapital.basisPoints)
  const purchases = accrual.bookings.filter(
    (entry) => entry.treatment === 'capitalised' && yearOf(entry.booking.date) === accrual.year && entry.booking.date < anniversary && negateMoney(entry.booking.amount) > above,
  )
  if (purchases.length === 0) {
    return []
  }
  return [
    {
      key: 'asset-purchase-decision',
      group: 'compliance',
      title: `A members’ decision for purchases above ${percentText(decision.priceShareOfCapital.basisPoints)} of the share capital in the first ${years} years`,
      on: null,
      settledBy: 'A members’ decision for each purchase, or the accountant’s or a lawyer’s view that ordinary equipment falls outside the rule.',
      figure: summed('Purchases kept as assets', purchases.map((entry) => bookingFigure(entry, negateMoney(entry.booking.amount))), 'ledger'),
      rules: ['hr.ztd.asset-purchase-decision'],
      settled: false,
    },
  ]
}
