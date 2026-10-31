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
import { words } from './words'

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

type JudgementId = Extract<AdjustmentId, 'grant-schedule' | 'arrears-cut-off' | 'representation-as-booked' | 'cost-placement' | 'receivable-placement' | 'liability-placement'>

const JUDGEMENTS: Readonly<Record<JudgementId, { readonly settledBy: string; readonly rules: readonly RuleId[] }>> = {
  'grant-schedule': {
    settledBy: words.judgements['grant-schedule'],
    rules: ['hr.acc.grant-recognition'],
  },
  'arrears-cut-off': {
    settledBy: words.judgements['arrears-cut-off'],
    rules: ['hr.acc.accrual-basis'],
  },
  'representation-as-booked': {
    settledBy: words.judgements['representation-as-booked'],
    rules: ['hr.cit.representation-add-back'],
  },
  'cost-placement': {
    settledBy: words.judgements['cost-placement'],
    rules: [],
  },
  'receivable-placement': {
    settledBy: words.judgements['receivable-placement'],
    rules: [],
  },
  'liability-placement': {
    settledBy: words.judgements['liability-placement'],
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
    [accrual.bridge.unexplainedBeforeTax, words.openItems.beforeTaxDiffers],
    [accrual.bridge.unexplainedAfterTax, words.openItems.afterTaxDiffers],
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
            settledBy: words.openItems.findTheRows,
            figure: gap.figure,
            rules: [],
            settled: false,
          },
        ],
  )
}

function completenessItems(accrual: AccrualYear): YearEndOpenItem[] {
  const months = accrual.uninvoicedMonths.map((entry): YearEndOpenItem => ({
    key: `uninvoiced-${entry.month}`,
    group: 'completeness',
    title: words.openItems.noInvoiceIn(monthLabel(entry.month), entry.nextInvoice.number),
    on: null,
    settledBy: words.openItems.invoiceSettles(entry.nextInvoice.number),
    figure: null,
    rules: ['hr.acc.accrual-basis'],
    settled: false,
  }))
  const purchases = accrual.purchasesWithoutAsset.map((purchase, index): YearEndOpenItem => ({
    key: `no-asset-${index}`,
    group: 'completeness',
    title: words.openItems.purchaseWithoutAsset(purchase.label),
    on: purchase.paidOn,
    settledBy: words.openItems.assetSettles,
    figure: purchase.cost,
    rules: ['hr.cit.asset-threshold', 'hr.acc.capitalisation'],
    settled: false,
  }))
  const everyMonth: YearEndOpenItem = {
    key: 'invoiced',
    group: 'completeness',
    title: words.openItems.everyMonth,
    on: null,
    settledBy: words.openItems.everyMonthReopens,
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
  const loans = ownerLoans(workbook.transactions, workbook.categories).loans.filter((loan) => loan.amount > 0 && loan.lentOn <= lastDay && (loan.repaidOn === null || loan.repaidOn >= firstDay))
  const loanItems: YearEndOpenItem[] = []
  if (loans.length > 0) {
    const lent = withDrill(
      summed(
        words.openItems.loansOpen,
        loans.map((loan) => withDrill({ ...tracedFigure(words.openItems.lentOn, loan.amount, 'ledger', []), on: loan.lentOn }, loan.drill)),
        'ledger',
      ),
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
        title: words.openItems.report(report, year),
        on: null,
        settledBy: words.openItems.reportSettles(report),
        figure: lent,
        rules: ['hr.cit.related-party-report'],
        settled: false,
      },
      {
        key: 'sole-member-deals',
        group: 'compliance',
        title: words.openItems.inWriting,
        on: null,
        settledBy: words.openItems.inWritingSettles,
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
      title: words.openItems.enoughInterest(carried, prescribed),
      on: null,
      settledBy: words.openItems.enoughInterestReopens(prescribed),
      figure: null,
      rules: ['hr.pit.loan-benefit'],
      settled: true,
    }
  }
  return {
    key: 'loan-benefit',
    group: 'compliance',
    title: words.openItems.benefit(carried, prescribed),
    on: null,
    settledBy: words.openItems.benefitSettles(prescribed),
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
      title: words.openItems.decision(percentText(decision.priceShareOfCapital.basisPoints), years),
      on: null,
      settledBy: words.openItems.decisionSettles,
      figure: summed(
        words.openItems.keptAsAssets,
        purchases.map((entry) => bookingFigure(entry, negateMoney(entry.booking.amount))),
        'ledger',
      ),
      rules: ['hr.ztd.asset-purchase-decision'],
      settled: false,
    },
  ]
}
