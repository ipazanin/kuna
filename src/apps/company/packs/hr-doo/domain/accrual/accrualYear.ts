import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import { isDefinedBucket } from '../../../../workbook/domain/bucket'
import type { Category } from '../../../../workbook/domain/workbook'
import type { HrDooWorkbook } from '../hrDooPart'
import type { YearEndStatement } from '../yearEnd/yearEnd'
import { civilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import { yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import { ZERO, addMoney, negateMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleId } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { assetBooks, depreciationAboveAllowed, depreciationByYear } from '../assets/assetBooks'
import type { DepreciationSettings } from '../assets/depreciationSchedule'
import { citLiability, taxPeriodOf } from '../cit/citLiability'
import type { CitLiability, TaxPeriod } from '../cit/citLiability'
import { lossesCarriedInto, taxBase } from '../cit/taxBase'
import type { TaxBase } from '../cit/taxBase'
import { grantResiduals } from '../grants/grantRelease'
import { relatedPartyInterest } from '../ownerLoanInterest'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import type { PackRole } from '../packRoles'
import { deducted, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { withDrill } from './accrualAdjustment'
import type { AccrualAdjustment, AdjustmentId } from './accrualAdjustment'
import { balanceSheetLines } from './accrualBalanceSheet'
import { accrualBookings, bookingFigure, hasVat, isCounted } from './accrualBookings'
import type { AccrualBooking, CapitalisedBooking, CountedBooking, TakenOutTreatment } from './accrualBookings'
import { moneyLine } from './accrualLines'
import type { AccrualLine, MoneyLine } from './accrualLines'
import { arrearsCutOff, bookingsAfterCutOff, grantScheduleJudgement, placementJudgement, representationAsBooked } from './closedYear'
import { COST_LINES, COST_LINE_LABELS, costLineOf } from './costLines'
import type { CostLine } from './costLines'
import { revenueByDelivery } from './revenueByDelivery'
import type { UninvoicedMonth } from './revenueByDelivery'
import { words } from './words'

/** What the accrual view of a year takes beyond the workbook. */
export interface AccrualInputs {
  /** The workbook's own setting, or the other one when a screen compares doubled rates. */
  readonly depreciation: DepreciationSettings
  /**
   * The corporate tax advances paid for the year, which the payment matching gives. Null leaves
   * PD lines 56 to 58 out, except in a first tax period, which has no advances.
   */
  readonly citAdvancesPaid: TracedFigure | null
}

/** From the app's cash net to profit before and after tax, one step per adjustment. */
export interface AccrualBridge {
  /** Net as the app's screens count it: the bank rows and the owner's advances of the year. */
  readonly cashNet: TracedFigure
  /** Every adjustment that changes profit, in reading order. They add up from the cash net to the profit before tax. */
  readonly steps: readonly AccrualAdjustment[]
  readonly profitBeforeTax: TracedFigure
  readonly corporateIncomeTax: AccrualAdjustment
  readonly profitAfterTax: TracedFigure
  /** The accountant's profit before tax less ours. Null when the year-end tab has no such figure or it agrees. */
  readonly unexplainedBeforeTax: AccrualAdjustment | null
  readonly unexplainedAfterTax: AccrualAdjustment | null
}

export interface CategoryTotal {
  readonly category: Category
  /** Signed as booked, so a cost is negative. */
  readonly figure: TracedFigure
}

/** One asset written off as small inventory when put in use in the year. */
export interface SmallInventoryWriteOff {
  /** The category of the payment that bought it. Null when no payment claims it. */
  readonly category: string | null
  readonly figure: TracedFigure
}

/** A purchase on a capital-purchase category above the asset threshold that no asset row claims. It counts in full as a cost. */
export interface PurchaseWithoutAsset {
  readonly label: string
  readonly paidOn: CivilDate
  readonly cost: TracedFigure
}

export interface AccrualYear {
  readonly year: number
  readonly period: TaxPeriod
  /** Profit and loss, balance sheet, PD and grant lines by the year-end tab's line ids. */
  readonly lines: readonly AccrualLine[]
  /** Every adjustment: those in the bridge, those to the tax base and the placements. */
  readonly adjustments: readonly AccrualAdjustment[]
  readonly bridge: AccrualBridge
  readonly taxBase: TaxBase
  readonly liability: CitLiability
  /** Each category's accrual figure in the year, for the konto lines that name it. */
  readonly categoryTotals: readonly CategoryTotal[]
  /** Small inventory written off in the year, one entry per asset. The cost lines count it on material costs as one figure. */
  readonly smallInventory: readonly SmallInventoryWriteOff[]
  /** Every booking the cash view counts, with what the accrual view does with it, after any cut-off. */
  readonly bookings: readonly AccrualBooking[]
  readonly uninvoicedMonths: readonly UninvoicedMonth[]
  readonly purchasesWithoutAsset: readonly PurchaseWithoutAsset[]
}

/**
 * The accrual profit and loss, balance sheet and PD build-up of a year, from the cash ledger, the
 * invoices, the assets, the grants and the rules. For a closed year whose year-end tab holds the
 * accountant's figure for a choice the ledger cannot show, the accountant's figure is used and the
 * difference to ours is a judgement adjustment: the grant's release, costs paid in arrears that
 * the accountant keeps in the next year, representation booked without the exchange loss inside a
 * card payment, and which line of a group a figure sits on.
 */
export function accrualYear(workbook: HrDooWorkbook, year: number, inputs: AccrualInputs, rules: RuleSource = ruleValue): AccrualYear {
  const period = taxPeriodOf(year, workbook.companyFacts.companyRegistered)
  const firstDay = civilDate(year, 1, 1)
  const inYear = (date: CivilDate) => yearOf(date) === year
  const accountantMoney = (statement: YearEndStatement, line: string): Money | null => {
    const found = workbook.yearEndLines.find((candidate) => candidate.year === year && candidate.statement === statement && candidate.line === line)
    return found?.figure.kind === 'money' ? found.figure.amount : null
  }

  const books = assetBooks(workbook.assets, workbook.grants, inputs.depreciation, rules)
  // The bridge adjusts the bookings as our policy times them. The lines use them after the
  // accountant's cut-off, which the bridge then shows as its own step.
  const byPolicy = accrualBookings(workbook, rules)
  const cutOff = arrearsCutOff(byPolicy, year, workbook.yearEndLines, workbook.categories)
  const bookings = bookingsAfterCutOff(byPolicy, cutOff)
  const paidInYear = byPolicy.filter((entry) => inYear(entry.booking.date))
  const delivered = revenueByDelivery(workbook.invoices, year, rules)
  const accrualRule = rules('hr.acc.accrual-basis', firstDay)

  const takenOutFigure = (treatment: TakenOutTreatment, label: string, ruleIds: readonly RuleId[]): TracedFigure => {
    const entries = paidInYear.filter((entry) => entry.treatment === treatment)
    return figureOfBookings(
      label,
      entries,
      (entry) => negateMoney(entry.booking.amount),
      ruleIds.map((id) => rules(id, firstDay).citation),
      year,
    )
  }
  const takenOut = (id: AdjustmentId, treatment: TakenOutTreatment, label: string, ruleIds: readonly RuleId[], lines: AccrualAdjustment['lines'] = []) =>
    explained(id, takenOutFigure(treatment, label, ruleIds), lines)

  const paymentsOut = takenOutFigure('revenue', words.year.paymentsOut, [])
  const revenueAdjustment = explained(
    'revenue-by-delivery',
    withDrill(tracedFigure(words.year.revenueByDelivery, addMoney(paymentsOut.amount, delivered.total.amount), 'invoices', [accrualRule.citation], [paymentsOut, delivered.total]), paymentsOut.drill),
    [{ statement: 'pl', line: 'sales' }],
  )

  const capitalised = paidInYear.filter((entry): entry is CapitalisedBooking => entry.treatment === 'capitalised')
  const capitalPurchases = explained(
    'capital-purchases',
    figureOfBookings(words.year.capitalPurchases, capitalised, (entry) => negateMoney(entry.vat.cost.amount), [rules('hr.acc.capitalisation', firstDay).citation], year),
    [{ statement: 'balance', line: 'tangible-assets' }],
  )

  const depreciationTotal = depreciationByYear(books.schedules).find((entry) => entry.year === year)?.total ?? null
  const depreciation = summed(words.year.depreciation, depreciationTotal === null ? [] : [depreciationTotal], 'assets')
  const writeOffs = books.schedules.flatMap((schedule) =>
    schedule.writeOff !== null && inYear(schedule.writeOff.on)
      ? [{ schedule, figure: { ...schedule.writeOff.figure, label: words.year.writtenOff(schedule.asset.name, schedule.writeOff.figure.label) } }]
      : [],
  )
  const writtenOff = (treatment: 'small-inventory' | 'depreciated', label: string) =>
    summed(
      label,
      writeOffs.filter((entry) => entry.schedule.treatment === treatment).map((entry) => entry.figure),
      'assets',
    )
  const smallInventory = writtenOff('small-inventory', words.year.smallInventory)
  const paymentCategoryOf = new Map(byPolicy.flatMap((entry) => (entry.treatment === 'capitalised' ? entry.assets.map((asset) => [asset, entry.category.slug] as const) : [])))
  const smallInventoryWriteOffs = writeOffs
    .filter((entry) => entry.schedule.treatment === 'small-inventory')
    .map((entry): SmallInventoryWriteOff => ({ category: paymentCategoryOf.get(entry.schedule.asset) ?? null, figure: entry.figure }))
  const disposals = writtenOff('depreciated', words.year.disposals)

  const grantChecks = grantResiduals(books.grants, workbook.yearEndLines)
  const grantCheck = grantChecks.find((check) => check.year === year) ?? null
  const released = summed(
    words.year.grantReleased,
    books.grants.flatMap((schedule) => schedule.years.filter((entry) => entry.year === year).map((entry) => entry.released)),
    'assets',
  )
  const grantJudgement = grantScheduleJudgement(grantCheck)
  const grantRelease: AccrualAdjustment = {
    id: 'grant-release',
    kind: (grantCheck?.released ?? null) !== null && grantJudgement === null ? 'matched' : 'explained',
    effect: 'profit',
    figure: released,
    lines: [
      { statement: 'grant', line: 'released-in-year' },
      { statement: 'pl', line: 'other-operating-income' },
    ],
  }

  const withInputVat = paidInYear.filter(hasVat).filter((entry) => entry.vat.inputVat.amount !== 0)
  const inputVat = explained(
    'input-vat',
    figureOfBookings(words.year.inputVat, withInputVat, (entry) => negateMoney(entry.vat.inputVat.amount), rulesOf(withInputVat.map((entry) => entry.vat.inputVat)), year),
    [{ statement: 'balance', line: 'receivables-state' }],
  )

  const moved = (id: AdjustmentId, label: string, chosen: (entry: CountedBooking) => boolean): AccrualAdjustment => {
    const entries = byPolicy.filter(isCounted).filter((entry) => chosen(entry) && timingChange(entry, year) !== 0)
    return explained(
      id,
      figureOfBookings(label, entries, (entry) => timingChange(entry, year), [accrualRule.citation], year),
      [],
    )
  }

  const depreciationStep: AccrualAdjustment = {
    id: 'depreciation',
    kind: accountantMoney('pl', 'depreciation') === depreciation.amount ? 'matched' : 'explained',
    effect: 'profit',
    figure: deducted(depreciation),
    lines: [{ statement: 'pl', line: 'depreciation' }],
  }
  const profitSteps: AccrualAdjustment[] = [
    revenueAdjustment,
    takenOut('owner-loans', 'owner-loan', words.year.ownerLoans, [], [{ statement: 'balance', line: 'receivables-members-employees' }]),
    takenOut('grant-receipts', 'grant', words.year.grantReceipts, ['hr.acc.grant-recognition', 'hr.cit.grant-revenue']),
    grantRelease,
    ...(grantJudgement === null ? [] : [grantJudgement]),
    capitalPurchases,
    depreciationStep,
    explained('asset-write-offs', deducted(summed(words.year.writeOffs, [smallInventory, disposals].filter(isShown), 'assets')), [
      ...(smallInventory.amount === 0 ? [] : [{ statement: 'pl', line: 'material-costs' } as const]),
      ...(disposals.amount === 0 ? [] : [{ statement: 'pl', line: 'impairment-provisions-other' } as const]),
    ]),
    inputVat,
    takenOut('vat-settlements', 'vat-settlement', words.year.vatSettlements, ['hr.vat.credit'], [{ statement: 'balance', line: 'receivables-state' }]),
    moved('arrears-reversed', words.year.arrearsReversed, (entry) => entry.timing === 'arrears' && inYear(entry.booking.date)),
    moved('arrears-accrued', words.year.arrearsAccrued, (entry) => entry.timing === 'arrears' && !inYear(entry.booking.date)),
    ...(cutOff === null ? [] : [cutOff.adjustment]),
    moved('prepaid-spread', words.year.prepaidSpread, (entry) => entry.timing === 'prepaid'),
    takenOut('corporate-tax-paid', 'corporate-income-tax', words.year.corporateTaxPaid, ['hr.cit.balance-due']),
    takenOut('profit-distributions', 'profit-distribution', words.year.profitDistributions, ['hr.ztd.distributable-profit']),
  ].filter((step) => isShown(step.figure))
  const profitJudgements = profitSteps.filter((step) => step.kind === 'judgement').map((step) => step.id)

  // The lines, from the same bookings, each category on one line.
  const counted = bookings.filter(isCounted)
  const amountInYear = (entry: CountedBooking) => sumMoney(entry.shares.filter((share) => yearOfMonth(share.month) === year).map((share) => share.amount))
  const contributing = counted.filter((entry) => entry.shares.some((share) => yearOfMonth(share.month) === year))
  const categoryTotals = [...new Set(contributing.map((entry) => entry.category))].map((category): CategoryTotal => {
    const entries = contributing.filter((entry) => entry.category === category)
    const drill = drillToTransactions({ period: { preset: 'custom', range: rangeOf(entries.map((entry) => entry.booking.date)) }, categories: [category.slug] })
    const figure = tracedFigure(category.label ?? category.slug, sumMoney(entries.map(amountInYear)), 'ledger', rulesOf(entries.map((entry) => entry.vat.cost)))
    return { category, figure: withDrill(figure, drill) }
  })
  const cutOffCategories = new Set([...(cutOff?.kept ?? [])].map((entry) => entry.category.slug))

  const grantIncome = grantJudgement === null ? released : summed(words.year.grantRelease, [released, grantJudgement.figure], 'assets')
  const otherIncome = categoryTotals.filter((entry) => entry.category.bucket === 'income').map((entry) => entry.figure)
  const otherOperatingIncome = summed(words.year.otherIncome, [grantIncome, ...otherIncome], 'ledger')

  const costSteps = new Map<CostLine, TracedFigure[]>(COST_LINES.map((line) => [line, []]))
  const costJudgements = new Map<CostLine, AdjustmentId[]>(COST_LINES.map((line) => [line, []]))
  for (const entry of categoryTotals.filter((candidate) => candidate.category.bucket !== 'income')) {
    const line = costLineOf(entry.category, year, workbook.yearEndLines)
    costSteps.get(line)?.push({ ...entry.figure, amount: negateMoney(entry.figure.amount) })
    if (cutOffCategories.has(entry.category.slug)) {
      costJudgements.get(line)?.push('arrears-cut-off')
    }
  }
  costSteps.get('depreciation')?.push(depreciation)
  costSteps.get('material-costs')?.push(smallInventory)
  costSteps.get('impairment-provisions-other')?.push(disposals)
  const ourCosts = new Map(COST_LINES.map((line) => [line, summed(COST_LINE_LABELS[line], (costSteps.get(line) ?? []).filter(isShown), 'ledger')]))
  const placement = placementJudgement(
    'cost-placement',
    words.year.costPlacement,
    'pl',
    new Map(COST_LINES.filter((line) => line !== 'depreciation').map((line) => [line, ourCosts.get(line)?.amount ?? ZERO])),
    year,
    workbook.yearEndLines,
  )
  const costLines = COST_LINES.map((line): MoneyLine => {
    const ours = ourCosts.get(line) ?? summed(COST_LINE_LABELS[line], [], 'ledger')
    const move = placement?.moves.get(line)
    const judgements = costJudgements.get(line) ?? []
    return move === undefined
      ? moneyLine('pl', line, ours, judgements)
      : moneyLine('pl', line, summed(ours.label, [ours, tracedFigure(words.year.asPlaced, move, 'accountant', [])], 'ledger'), [...judgements, 'cost-placement'])
  })

  const sales = tracedFigure(words.year.sales, delivered.total.amount, 'invoices', delivered.total.rules, [delivered.total])
  const ownUse = tracedFigure(words.year.ownUse, ZERO, 'ledger', [])
  const financialIncome = tracedFigure(words.year.financialIncome, ZERO, 'ledger', [])
  const revenue = summed(words.year.revenue, [sales, ownUse, otherOperatingIncome, financialIncome], 'ledger')
  const expenses = summed(
    words.year.expenses,
    costLines.map((line) => line.figure),
    'ledger',
  )
  const profitBeforeTax = tracedFigure(words.year.profitBeforeTax, subtractMoney(revenue.amount, expenses.amount), 'ledger', rulesOf([revenue, expenses]), [revenue, deducted(expenses)])

  const yearDrill = (categories: readonly string[]): DrillTarget => drillToTransactions({ period: { preset: 'year', year }, categories })
  const representationSlugs = categoriesWithRole(workbook.categories, PACK_ROLES.representation)
  const representationEntries = counted.filter((entry) => representationSlugs.includes(entry.category.slug) && amountInYear(entry) !== 0)
  // Representation VAT is never deductible, so any VAT a wrong treatment took out goes back in.
  const representationOurs = figureOfBookings(
    words.year.representation,
    representationEntries,
    (entry) => negateMoney(addMoney(amountInYear(entry), inYear(entry.booking.date) ? entry.vat.inputVat.amount : ZERO)),
    [],
    year,
  )
  const representationJudgement = representationAsBooked(year, workbook.yearEndLines, workbook.categories, representationOurs)
  const costOfRole = (role: PackRole, label: string): TracedFigure => {
    const slugs = categoriesWithRole(workbook.categories, role)
    const figures = categoryTotals.filter((entry) => slugs.includes(entry.category.slug)).map((entry) => entry.figure)
    return withDrill(tracedFigure(label, negateMoney(sumMoney(figures.map((figure) => figure.amount))), 'ledger', rulesOf(figures), figures), yearDrill(slugs))
  }
  const lossesBroughtForward = lossesCarriedInto(year, workbook.yearEndLines, rules)
  const base = taxBase(
    {
      year,
      revenue: tracedFigure(words.year.pdRevenue, revenue.amount, 'ledger', revenue.rules, [revenue]),
      expenses: tracedFigure(words.year.pdExpenses, expenses.amount, 'ledger', expenses.rules, [expenses]),
      representation: representationJudgement === null ? representationOurs : summed(words.year.representationAsBooked, [representationOurs, representationJudgement.figure], 'ledger'),
      personalTransport: costOfRole(PACK_ROLES.personalTransport, words.year.personalTransport),
      nonDeductible: costOfRole(PACK_ROLES.nonDeductible, words.year.neverAllowed),
      depreciationAboveAllowed: depreciationAboveAllowed(books.schedules, year),
      relatedPartyInterestShortfall: relatedPartyInterest(workbook, year, profitBeforeTax.amount, lossesBroughtForward, rules),
      lossesBroughtForward,
    },
    rules,
  )
  const liability = citLiability(base, period, inputs.citAdvancesPaid, rules)
  const taxJudgements = [...profitJudgements, ...(representationJudgement === null ? [] : [representationJudgement.id])]

  const corporateIncomeTax: AccrualAdjustment = {
    id: 'corporate-income-tax',
    kind: accountantMoney('pl', 'corporate-income-tax') === liability.liability.amount ? 'matched' : 'explained',
    effect: 'profit',
    figure: tracedFigure(words.year.corporateIncomeTax, negateMoney(liability.liability.amount), 'ledger', liability.liability.rules, [deducted(liability.liability)]),
    lines: [{ statement: 'pl', line: 'corporate-income-tax' }],
  }
  const profitAfterTax = tracedFigure(words.year.profitAfterTax, subtractMoney(profitBeforeTax.amount, liability.liability.amount), 'ledger', rulesOf([profitBeforeTax, liability.liability]), [
    profitBeforeTax,
    deducted(liability.liability),
  ])

  const balance = balanceSheetLines({
    workbook,
    year,
    bookings,
    books,
    grantChecks,
    liability,
    profitAfterTax,
    profitJudgements: taxJudgements,
    cutOffCategories,
    firstPeriod: period.first,
    rules,
  })

  const grantJudgements: AdjustmentId[] = grantJudgement === null ? [] : ['grant-schedule']
  const lines: AccrualLine[] = [
    moneyLine('pl', 'sales', sales),
    moneyLine('pl', 'own-use', ownUse),
    moneyLine('pl', 'other-operating-income', otherOperatingIncome, grantJudgements),
    moneyLine('pl', 'financial-income', financialIncome),
    ...costLines,
    moneyLine('pl', 'profit-before-tax', profitBeforeTax, profitJudgements),
    moneyLine('pl', 'corporate-income-tax', liability.liability, taxJudgements),
    moneyLine('pl', 'profit-after-tax', profitAfterTax, taxJudgements),
    ...balance.lines,
    moneyLine('tax', 'revenue', base.revenue, grantJudgements),
    moneyLine('tax', 'expenses', base.expenses, cutOff === null ? [] : ['arrears-cut-off']),
    moneyLine('tax', 'increases', base.increases, representationJudgement === null ? [] : ['representation-as-booked']),
    moneyLine('tax', 'decreases', base.decreases),
    moneyLine('tax', 'tax-base', base.base, taxJudgements),
    { kind: 'rate', statement: 'tax', line: 'rate', rate: liability.rate, judgements: [] },
    moneyLine('tax', 'liability', liability.liability, taxJudgements),
    ...(liability.advancesPaid === null ? [] : [moneyLine('tax', 'advances-paid', liability.advancesPaid)]),
    ...(liability.balanceDue === null ? [] : [moneyLine('tax', 'balance-due', liability.balanceDue, taxJudgements)]),
    ...(liability.refund === null ? [] : [moneyLine('tax', 'refund', liability.refund, taxJudgements)]),
    moneyLine('tax', 'monthly-advance', liability.monthlyAdvance, taxJudgements),
    { kind: 'count', statement: 'tax', line: 'months-of-operation', label: words.year.monthsOfPeriod, count: liability.periodMonths, judgements: [] },
    moneyLine('grant', 'released-in-year', grantIncome, grantJudgements),
    balance.grantDeferred,
  ]

  const unexplained = (id: Extract<AdjustmentId, 'unexplained-before-tax' | 'unexplained-after-tax'>, line: string, ours: TracedFigure): AccrualAdjustment | null => {
    const theirs = accountantMoney('pl', line)
    if (theirs === null || theirs === ours.amount) {
      return null
    }
    const figure = tracedFigure(words.year.notExplained, subtractMoney(theirs, ours.amount), 'accountant', [], [tracedFigure(words.year.theAccountant, theirs, 'accountant', []), deducted(ours)])
    return { id, kind: 'open', effect: 'profit', figure, lines: [{ statement: 'pl', line }] }
  }

  const threshold = rules('hr.cit.asset-threshold', firstDay).value.unitCostAbove.cents
  const capitalSlugs = categoriesWithRole(workbook.categories, PACK_ROLES.capitalPurchase)
  const purchasesWithoutAsset = counted
    .filter((entry) => inYear(entry.booking.date) && capitalSlugs.includes(entry.category.slug) && negateMoney(entry.vat.cost.amount) > threshold)
    .map((entry) => ({ label: entry.label, paidOn: entry.booking.date, cost: withDrill({ ...entry.vat.cost, amount: negateMoney(entry.vat.cost.amount) }, entry.drill) }))

  return {
    year,
    period,
    lines,
    adjustments: [
      ...profitSteps,
      corporateIncomeTax,
      ...(representationJudgement === null ? [] : [representationJudgement]),
      ...(placement === null ? [] : [placement.adjustment]),
      ...balance.placements,
    ],
    bridge: {
      cashNet: cashNetOf(paidInYear, workbook, year),
      steps: profitSteps,
      profitBeforeTax,
      corporateIncomeTax,
      profitAfterTax,
      unexplainedBeforeTax: unexplained('unexplained-before-tax', 'profit-before-tax', profitBeforeTax),
      unexplainedAfterTax: unexplained('unexplained-after-tax', 'profit-after-tax', profitAfterTax),
    },
    taxBase: base,
    liability,
    categoryTotals,
    smallInventory: smallInventoryWriteOffs,
    bookings,
    uninvoicedMonths: delivered.uninvoicedMonths,
    purchasesWithoutAsset,
  }
}

/** The line of the year with the id, or null when the engine does not compute it. */
export function accrualLine(accrual: AccrualYear, statement: AccrualLine['statement'], line: string): AccrualLine | null {
  return accrual.lines.find((candidate) => candidate.statement === statement && candidate.line === line) ?? null
}

function cashNetOf(entries: readonly AccrualBooking[], workbook: HrDooWorkbook, year: number): TracedFigure {
  const buckets = [...new Set(entries.map((entry) => entry.booking.bucket))].filter(isDefinedBucket)
  const steps = buckets.map((bucket) =>
    withDrill(
      tracedFigure(workbook.settings.bucketLabels[bucket], sumMoney(entries.filter((entry) => entry.booking.bucket === bucket).map((entry) => entry.booking.amount)), 'ledger', []),
      drillToTransactions({ period: { preset: 'year', year }, buckets: [bucket] }),
    ),
  )
  return withDrill(summed(words.year.cashNet, steps, 'ledger'), drillToTransactions({ period: { preset: 'year', year } }))
}

/** A total over bookings, one step per booking that opens it, the total opening the year's rows of their categories. */
function figureOfBookings<Entry extends AccrualBooking>(label: string, entries: readonly Entry[], amountOf: (entry: Entry) => Money, citations: TracedFigure['rules'], year: number): TracedFigure {
  const steps = entries.map((entry) => bookingFigure(entry, amountOf(entry)))
  const drill =
    entries.length === 0
      ? null
      : drillToTransactions({
          period: { preset: 'custom', range: rangeOf([civilDate(year, 1, 1), civilDate(year, 12, 31), ...entries.map((entry) => entry.booking.date)]) },
          categories: [...new Set(entries.map((entry) => entry.category.slug))],
        })
  return withDrill(tracedFigure(label, sumMoney(steps.map((step) => step.amount)), 'ledger', citations, steps), drill)
}

/** How much the accrual view moves a counted booking into or out of the year. */
function timingChange(entry: CountedBooking, year: number): Money {
  const inYear = sumMoney(entry.shares.filter((share) => yearOfMonth(share.month) === year).map((share) => share.amount))
  const paidInYear = yearOf(entry.booking.date) === year ? sumMoney(entry.shares.map((share) => share.amount)) : ZERO
  return subtractMoney(inYear, paidInYear)
}

function explained(id: AdjustmentId, figure: TracedFigure, lines: AccrualAdjustment['lines']): AccrualAdjustment {
  return { id, kind: 'explained', effect: 'profit', figure, lines }
}

function isShown(step: TracedFigure): boolean {
  return step.amount !== 0 || step.steps.length > 0
}

function rangeOf(dates: readonly CivilDate[]): DateRange {
  const sorted = [...dates].sort()
  return { from: sorted[0] as CivilDate, to: sorted[sorted.length - 1] as CivilDate }
}
