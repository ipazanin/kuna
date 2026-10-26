import type { RouteLocationRaw } from 'vue-router'

import { chartTokens } from '../../../../shared/charts/chartTokens'
import type { DonutPart } from '../../../../shared/ui/DonutCard.vue'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import type { YearEndFigure } from '../../domain/yearEnd/yearEnd'
import { dayLabel } from '../../ruleset/presentation/ruleWording'
import type { Rate } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { AccrualAdjustment } from '../../domain/accrual/accrualAdjustment'
import type { AccrualLine } from '../../domain/accrual/accrualLines'
import { accrualYear } from '../../domain/accrual/accrualYear'
import { amountOnLine } from '../../domain/accrual/closedYear'
import { percentText } from '../../domain/payroll/payrollArithmetic'
import { compareYearEnd } from '../../domain/yearEnd/yearEndComparison'
import type { ComparedLine, ComparedStatement, LineStatus } from '../../domain/yearEnd/yearEndComparison'
import { yearEndOpenItems } from '../../domain/yearEnd/yearEndOpenItems'
import { chipsOf, figureDetail, figureLabel, ruleChips, stepsOf } from '../tracedFigureView'
import { bridgeChart } from '../bridgeChart'
import type { BridgeBar } from '../bridgeChart'
import type { BridgeStepView } from './BridgeSteps.vue'
import type { ComparisonRow, ShownValue } from './ComparisonTable.vue'
import { ADJUSTMENT_LABELS, STATUSES, STATUS_WORDING, lineLabel } from './yearEndWording'

type Link = (drill: DrillTarget | null) => RouteLocationRaw | null

const TABLES: readonly { readonly key: string; readonly title: string; readonly description: string; readonly statements: readonly ComparedStatement[] }[] = [
  {
    key: 'pl',
    title: 'Profit and loss',
    description: 'The accountant’s lines beside ours on the accrual view and on the cash view, with the grant released.',
    statements: ['pl', 'grant'],
  },
  {
    key: 'balance',
    title: 'Balance sheet at 31 December',
    description: 'The cash view has no balance sheet beyond cash, so the other lines compare the accrual view alone.',
    statements: ['balance', 'grant'],
  },
  { key: 'tax', title: 'Profit tax return, PD', description: 'The build-up of the corporate tax by form line.', statements: ['tax'] },
]

const GRANT_LINES: Readonly<Record<string, string>> = { 'released-in-year': 'pl', 'deferred-at-year-end': 'balance' }

/** The colour of each status on the ring, its badge's tone. */
const STATUS_TONES: Readonly<Record<LineStatus, string>> = {
  matched: '--tone-positive',
  explained: '--tone-info',
  judgement: '--tone-warning',
  open: '--tone-negative',
}

export type ClosedYearView = ReturnType<typeof closedYearView>

/**
 * A year the accountant has closed, set beside ours: the lines by status, the bridge from the cash
 * net to profit, the open items, the statements line by line and the konto lines. `statements` is
 * where a status on the ring opens the lines.
 */
export function closedYearView(workbook: HrDooWorkbook, year: number, link: Link, statements: RouteLocationRaw) {
  const accrual = accrualYear(workbook, year, { depreciation: workbook.companyFacts, citAdvancesPaid: null })
  const comparison = compareYearEnd(workbook, accrual)
  const { bridge } = accrual
  const drillOf = (figure: TracedFigure | null) => link(figure?.drill ?? null)

  const bars: BridgeBar[] = [
    { label: 'Cash net', kind: 'total', amount: bridge.cashNet.amount, drill: bridge.cashNet.drill },
    ...bridge.steps.map((step): BridgeBar => ({ label: ADJUSTMENT_LABELS[step.id], kind: 'step', amount: step.figure.amount, drill: step.figure.drill })),
    { label: 'Profit before tax', kind: 'total', amount: bridge.profitBeforeTax.amount, drill: null },
    { label: ADJUSTMENT_LABELS['corporate-income-tax'], kind: 'step', amount: bridge.corporateIncomeTax.figure.amount, drill: null },
    { label: 'Profit after tax', kind: 'total', amount: bridge.profitAfterTax.amount, drill: null },
    { label: 'Not explained', kind: 'residual', amount: bridge.unexplainedAfterTax?.figure.amount ?? 0, drill: null },
  ]
  const total = (key: string, figure: TracedFigure): BridgeStepView => ({ key, label: figureLabel(figure), cents: figure.amount, to: drillOf(figure), kind: null, rules: [] })
  const adjustment = (entry: AccrualAdjustment): BridgeStepView => ({
    key: entry.id,
    label: figureLabel(entry.figure),
    cents: entry.figure.amount,
    to: drillOf(entry.figure),
    kind: entry.kind,
    rules: ruleChips(entry.figure.rules),
  })
  const residual = (id: string, label: string, entry: AccrualAdjustment | null): BridgeStepView => ({
    key: id,
    label,
    cents: entry?.figure.amount ?? 0,
    to: null,
    kind: entry === null ? 'matched' : 'open',
    rules: [],
  })
  const openItems = yearEndOpenItems(workbook, accrual)
  const statusCounts = STATUSES.map((status) => ({ status, count: comparison.lines.filter((line) => line.status === status).length }))

  function rowOf(compared: ComparedLine): ComparisonRow {
    const { ours, cash } = compared
    return {
      key: `${compared.statement}-${compared.line}`,
      label: lineLabel(compared.statement, compared.line),
      printed: compared.accountant.label,
      accountant: shownOf(compared.accountant.figure),
      ours: ours === null ? null : oursValue(ours),
      oursTo: ours?.kind === 'money' ? drillOf(ours.figure) : null,
      cash: cash?.amount ?? null,
      cashTo: drillOf(cash),
      difference: compared.difference,
      residual: compared.residual,
      status: compared.status,
      explainedBy: compared.explainedBy.map((entry) => ({
        key: entry.id,
        label: ADJUSTMENT_LABELS[entry.id],
        cents: amountOnLine(entry, compared.line),
        to: drillOf(entry.figure),
        depth: 0,
      })),
      oursSteps: ours?.kind === 'money' ? stepsOf(ours.figure, drillOf) : [],
      cashSteps: stepsOf(cash, drillOf),
      rules: ruleChips(ours === null ? [] : ours.kind === 'money' ? ours.figure.rules : ours.kind === 'rate' ? ours.rate.rules : []),
    }
  }

  return {
    lines: {
      parts: statusCounts.map(
        ({ status, count }): DonutPart => ({ key: status, label: STATUS_WORDING[status].label, value: count, colour: STATUS_TONES[status], to: statements }),
      ),
      total: comparison.lines.length,
      description: `The accountant's ${comparison.lines.length} lines for ${year}: ${statusCounts.map(({ status, count }) => `${count} ${STATUS_WORDING[status].label.toLowerCase()}`).join(', ')}.`,
    },
    chart: bridgeChart(bars, chartTokens()),
    chartHeight: bars.length * 28 + 48,
    steps: [
      total('cash-net', bridge.cashNet),
      ...bridge.steps.map(adjustment),
      total('profit-before-tax', bridge.profitBeforeTax),
      residual('unexplained-before-tax', 'Not explained before tax', bridge.unexplainedBeforeTax),
      adjustment(bridge.corporateIncomeTax),
      total('profit-after-tax', bridge.profitAfterTax),
      residual('unexplained-after-tax', 'Not explained after tax', bridge.unexplainedAfterTax),
    ],
    tables: TABLES.map((table) => {
      const rows = comparison.lines
        .filter((line) => table.statements.includes(line.statement) && (line.statement !== 'grant' || GRANT_LINES[line.line] === table.key))
        .map(rowOf)
      return { ...table, rows, summary: statusesInWords(rows) }
    }),
    recorded: comparison.recorded.map((entry) => ({
      key: `${entry.accountant.statement}-${entry.accountant.line}`,
      label: lineLabel(entry.accountant.statement, entry.accountant.line),
      value: shownOf(entry.accountant.figure),
      check: entry.check === null ? null : { status: (entry.check.holds ? 'matched' : 'open') as LineStatus, finding: entry.check.finding, to: link(entry.check.drill) },
    })),
    distribution: comparison.distribution,
    konto: comparison.konto.map((group) => ({
      key: group.konto.map((line) => line.line).join('-'),
      konto: group.konto.map((line) => ({ line: line.line, label: line.label, cents: line.figure.kind === 'money' ? line.figure.amount : 0 })),
      categories: group.categories.map((figure, index) => ({ key: `${index}-${figure.label}`, label: figureLabel(figure), cents: figure.amount, to: drillOf(figure) })),
      accountant: group.accountant,
      ours: group.ours,
      difference: group.difference,
    })),
    unnamedKonto: comparison.unnamedKonto.map((line) => ({ line: line.line, label: line.label, cents: line.figure.kind === 'money' ? line.figure.amount : 0 })),
    kontoSummary: `${comparison.konto.length} compared, ${comparison.konto.filter((group) => group.difference !== 0).length} with a difference`,
    openItems: openItems.map((item) => ({
      key: item.key,
      group: item.group,
      title: figureLabel({ label: item.title, on: item.on }),
      settledBy: item.settledBy,
      settled: item.settled,
      cents: item.figure?.amount ?? null,
      to: drillOf(item.figure),
      detail: item.figure !== null && item.figure.drill === null && item.figure.steps.length > 0 ? figureDetail(item.figure, item.title === figureLabel(item.figure) ? `An open item of year end ${year}` : item.title, link) : null,
      rules: chipsOf(item.rules),
    })),
    openItemsSummary: `${openItems.filter((item) => !item.settled).length} to settle, ${openItems.filter((item) => item.settled).length} settled`,
    noVat: workbook.categories.every((category) => category.vat === 'none'),
    unregistered: workbook.companyFacts.companyRegistered === null,
  }
}

/** "8 lines: 5 matched, 2 explained, 1 open", in the order of the statuses. */
function statusesInWords(rows: readonly ComparisonRow[]): string {
  if (rows.length === 0) return 'No lines for the year'
  const counts = STATUSES.map((status) => ({ status, count: rows.filter((row) => row.status === status).length })).filter((entry) => entry.count > 0)
  return `${rows.length} ${rows.length === 1 ? 'line' : 'lines'}: ${counts.map((entry) => `${entry.count} ${STATUS_WORDING[entry.status].label.toLowerCase()}`).join(', ')}`
}

function shownOf(figure: YearEndFigure): ShownValue {
  return figure.kind === 'money' ? { cents: figure.amount } : { text: shownText(figure) }
}

function shownText(figure: YearEndFigure): string {
  switch (figure.kind) {
    case 'money':
      return ''
    case 'rate':
      return percentText(figure.basisPoints as Rate)
    case 'count':
      return String(figure.count)
    case 'date':
      return dayLabel(figure.date)
  }
}

function oursValue(line: AccrualLine): ShownValue {
  if (line.kind === 'money') return { cents: line.figure.amount }
  if (line.kind === 'rate') return { text: percentText(line.rate.basisPoints) }
  return { text: String(line.count) }
}
