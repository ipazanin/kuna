import { describe, expect, it } from 'vitest'

import { createFakeSheets } from '../src/features/workbook/infrastructure/fake/fakeSheets'
import { fakeWorkbookValues } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readSnapshotFrom } from '../src/features/workbook/infrastructure/googleWorkbookPorts'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot, WorkbookTab } from '../src/features/workbook/infrastructure/workbookSnapshot'

/** Serial numbers of the date cells the rows below use. */
const DAY = {
  '2025-05-28': 45805,
  '2025-06-01': 45809,
  '2025-11-21': 45982,
  '2025-11-24': 45985,
  '2026-01-31': 46053,
  '2026-02-01': 46054,
  '2026-02-28': 46081,
  '2026-03-31': 46112,
  '2027-01-15': 46402,
  '2027-06-30': 46568,
  '2027-07-01': 46569,
  '2028-01-10': 46762,
} as const

const CATEGORIES: CellValue[][] = [
  ['category', 'family', 'bucket', 'roles', 'vat'],
  ['revenue', 'income', 'income', 'revenue'],
  ['software', 'operating', 'operating', '', 'reverse-charge'],
  ['telecom', 'operating', 'operating', 'arrears', 'Deductible-25'],
  ['equipment', 'operating', 'operating', 'capital-purchase', 'half'],
  ['vat-refund', 'operating', 'operating', 'vat-settlement'],
]

function workbookWith(tabs: Partial<Record<WorkbookTab, CellValue[][]>>) {
  const snapshot: WorkbookSnapshot = {
    meta: { id: 'sheet', source: 'excel', title: 'Example Studio d.o.o.', syncedAt: '2026-10-18T08:00:00.000Z', ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...EMPTY_TABS,
    categories: sheetRowsFromValues(CATEGORIES),
    ...Object.fromEntries(Object.entries(tabs).map(([tab, values]) => [tab, sheetRowsFromValues(values)])),
  }
  return readWorkbook(snapshot)
}

function problemsOn(workbook: ReturnType<typeof workbookWith>, tab: WorkbookTab): [number, string][] {
  return workbook.problems.filter((problem) => problem.tab === tab).map((problem) => [problem.sheetRow, problem.reason])
}

describe('the vat column of categories', () => {
  it('reads a treatment in any case, blank as none, and an unknown one as none with a problem', () => {
    const workbook = workbookWith({})

    expect(workbook.categories.map((category) => [category.slug, category.vat])).toEqual([
      ['revenue', 'none'],
      ['software', 'reverse-charge'],
      ['telecom', 'deductible-25'],
      ['equipment', 'none'],
      ['vat-refund', 'none'],
    ])
    expect(problemsOn(workbook, 'categories')).toEqual([[5, 'vat "half" is not a VAT treatment, so equipment reads as none']])
  })
})

describe('the delivery period of invoices', () => {
  it('reads both dates, and keeps an invoice whose period cannot be read with the issue date standing for it', () => {
    const workbook = workbookWith({
      clients: [['client', 'iban'], ['north', 'XX00FAKE0101']],
      invoices: [
        ['number', 'client', 'amount', 'issued', 'period_from', 'period_to'],
        ['1-1-26', 'north', 7200, DAY['2026-01-31'], DAY['2026-01-31'] - 30, DAY['2026-01-31']],
        ['2-1-26', 'north', 7200, DAY['2026-02-28']],
        ['3-1-26', 'north', 7200, DAY['2026-03-31'], DAY['2026-02-01']],
        ['4-1-26', 'north', 7200, DAY['2026-03-31'], DAY['2026-03-31'], DAY['2026-02-01']],
      ],
    })

    expect(workbook.invoices.map((invoice) => [invoice.number, invoice.deliveryPeriod])).toEqual([
      ['1-1-26', { from: '2026-01-01', to: '2026-01-31' }],
      ['2-1-26', null],
      ['3-1-26', null],
      ['4-1-26', null],
    ])
    expect(problemsOn(workbook, 'invoices')).toEqual([
      [4, 'period_from and period_to go together, and only one is filled, so the issue date stands for the delivery period'],
      [5, 'period_to 2026-02-01 is before period_from 2026-03-31, so the issue date stands for the delivery period'],
    ])
  })
})

describe('the assets tab', () => {
  const header = ['asset', 'bought', 'in_use', 'cost_net', 'group', 'doubled', 'disposed', 'funded_by', 'ledger_reference', 'note']

  it('reads a purchase, taking the purchase day for a blank in_use and keeping a grant the grants tab lacks with a problem', () => {
    const workbook = workbookWith({
      grants: [['grant', 'received', 'amount', 'release', 'period_from', 'period_to'], ['startup', DAY['2025-06-01'], 5000, 'straight-line', DAY['2025-06-01'], DAY['2027-06-30']]],
      assets: [
        header,
        ['Laptop 14 inch', DAY['2025-05-28'], DAY['2025-06-01'], 1519.2, 'Computers', true, '', 'startup', 'FAKE-REF-0002', 'Main machine'],
        ['Phone', DAY['2025-11-21'], '', 640.01, 'computers', 'FALSE', DAY['2028-01-10'], 'innovation'],
      ],
    })

    expect(workbook.assets).toEqual([
      {
        name: 'Laptop 14 inch',
        bought: '2025-05-28',
        inUse: '2025-06-01',
        costNet: 151920,
        group: 'computers',
        doubledRate: true,
        disposed: null,
        fundedBy: 'startup',
        ledgerReference: 'FAKE-REF-0002',
        note: 'Main machine',
        sheetRow: 2,
      },
      expect.objectContaining({ name: 'Phone', inUse: '2025-11-21', costNet: 64001, doubledRate: false, disposed: '2028-01-10', fundedBy: 'innovation', sheetRow: 3 }),
    ])
    expect(problemsOn(workbook, 'assets')).toEqual([[3, "innovation is not on the grants tab, so the asset's depreciation releases no grant"]])
  })

  it('leaves out a row it cannot depreciate, and says why', () => {
    const workbook = workbookWith({
      assets: [
        header,
        ['', DAY['2025-05-28'], '', 100, 'other'],
        ['Desk', '2025-05-28', '', 100, 'other'],
        ['Chair', DAY['2025-06-01'], DAY['2025-05-28'], 100, 'other'],
        ['Monitor', DAY['2025-06-01'], '', 0, 'equipment'],
        ['Printer', DAY['2025-06-01'], '', 'cheap', 'equipment'],
        ['Lamp', DAY['2025-06-01'], '', 50, 'furniture'],
        ['Router', DAY['2025-06-01'], '', 50, 'equipment', 'maybe'],
        ['Scanner', DAY['2025-11-24'], '', 50, 'equipment', '', DAY['2025-11-21']],
        ['Server', DAY['2025-06-01'], '', 900, 'computers'],
        ['server', DAY['2025-06-01'], '', 900, 'computers'],
      ],
    })

    expect(workbook.assets.map((asset) => asset.name)).toEqual(['Server'])
    expect(problemsOn(workbook, 'assets')).toEqual([
      [2, 'no asset name'],
      [3, 'bought "2025-05-28" is not a date cell'],
      [4, 'in_use 2025-05-28 is before bought 2025-06-01'],
      [5, 'cost_net must be more than zero'],
      [6, 'cost_net "cheap" is not a number'],
      [7, '"furniture" is not a group. Use computers, equipment, car, building, other'],
      [8, 'doubled "maybe" is neither TRUE nor FALSE'],
      [9, 'disposed 2025-11-21 is before in_use 2025-11-24'],
      [11, '"server" is already listed above'],
    ])
  })
})

describe('the grants tab', () => {
  const header = ['grant', 'received', 'amount', 'fixed_part', 'variable_part', 'period_from', 'period_to', 'release', 'clawback_year1', 'clawback_year2', 'employment_required_until', 'note']

  it('reads the terms, a blank release as fixed-then-assets, and whole or an amount as the clawback', () => {
    const workbook = workbookWith({
      grants: [header, ['Startup', DAY['2025-06-01'], 14515.97, 2500, 12015.97, DAY['2025-06-01'], DAY['2027-06-30'], '', 'Whole', 12015.97, DAY['2027-06-30'], 'Agency grant']],
    })

    expect(workbook.grants).toEqual([
      {
        slug: 'startup',
        received: '2025-06-01',
        amount: 1451597,
        parts: { fixed: 250000, variable: 1201597 },
        period: { from: '2025-06-01', to: '2027-06-30' },
        release: 'fixed-then-assets',
        clawbackFirstYear: 'whole',
        clawbackSecondYear: 1201597,
        employmentRequiredUntil: '2027-06-30',
        note: 'Agency grant',
        sheetRow: 2,
      },
    ])
    expect(workbook.problems).toEqual([expect.objectContaining({ tab: 'categories' })])
  })

  it('leaves out a grant whose parts or period do not fit its release', () => {
    const workbook = workbookWith({
      grants: [
        header,
        ['a', DAY['2025-06-01'], 1000, 400, 500],
        ['b', DAY['2025-06-01'], 1000, 400],
        ['c', DAY['2025-06-01'], 1000],
        ['d', DAY['2025-06-01'], 1000, '', '', '', '', 'straight-line'],
        ['e', DAY['2025-06-01'], 1000, 1000, 0, '', '', 'monthly'],
        ['f', DAY['2025-06-01'], 1000, 1000, 0, '', '', '', 'half'],
        ['g', DAY['2025-06-01'], 1000, 1000, 0],
        ['G', DAY['2025-06-01'], 1000, 1000, 0],
      ],
    })

    expect(workbook.grants.map((grant) => grant.slug)).toEqual(['g'])
    expect(problemsOn(workbook, 'grants')).toEqual([
      [2, 'fixed_part and variable_part add up to 900.00, not the amount 1000.00'],
      [3, 'fixed_part and variable_part go together, and only one is filled'],
      [4, 'a fixed-then-assets release needs fixed_part and variable_part'],
      [5, 'a straight-line release needs period_from and period_to'],
      [6, '"monthly" is not a release. Use fixed-then-assets, straight-line'],
      [7, 'clawback_year1 "half" is neither whole nor an amount above zero'],
      [9, '"g" is already listed above'],
    ])
  })
})

describe('the year-end tab', () => {
  const header = ['year', 'statement', 'line', 'label', 'amount', 'categories', 'aop', 'source', 'note']

  it('reads money, date, rate and count lines and the categories of a konto row', () => {
    const workbook = workbookWith({
      'year-end': [
        header,
        [2025, 'PL', 'Sales', 'Prihodi od prodaje', 46800, '', '', 'package.pdf'],
        [2025, 'tax', 'rate', 'Stopa', 0.1],
        [2025, 'tax', 'filed-on', 'Predano', DAY['2026-02-01']],
        [2025, 'tax', 'months-of-operation', 'Mjeseci', 7],
        [2025, 'konto', '41810', 'Računovodstvene usluge', 1500, 'software, telecom', '', '', 'Two categories'],
      ],
    })

    expect(workbook.yearEndLines.map((line) => [line.statement, line.line, line.figure, line.categories])).toEqual([
      ['pl', 'sales', { kind: 'money', amount: 4680000 }, []],
      ['tax', 'rate', { kind: 'rate', basisPoints: 1000 }, []],
      ['tax', 'filed-on', { kind: 'date', date: '2026-02-01' }, []],
      ['tax', 'months-of-operation', { kind: 'count', count: 7 }, []],
      ['konto', '41810', { kind: 'money', amount: 150000 }, ['software', 'telecom']],
    ])
    expect(workbook.yearEndLines[0]).toMatchObject({ year: 2025, label: 'Prihodi od prodaje', source: 'package.pdf', sheetRow: 2 })
    expect(problemsOn(workbook, 'year-end')).toEqual([])
  })

  it('leaves out an unknown line, a figure of the wrong kind and a key used twice, and reports a stray categories cell', () => {
    const workbook = workbookWith({
      'year-end': [
        header,
        ['last year', 'pl', 'sales', '', 1],
        [2025, 'notes', 'sales', '', 1],
        [2025, 'pl', 'turnover', '', 1],
        [2025, 'konto', '', '', 1],
        [2025, 'tax', 'rate', '', 10],
        [2025, 'tax', 'paid-on', '', 'April'],
        [2025, 'pl', 'sales', '', 'lots'],
        [2025, 'pl', 'sales', '', 100, 'software'],
        [2025, 'pl', 'sales', '', 200],
        [2025, 'konto', '41200', '', 50, 'snacks'],
      ],
    })

    expect(workbook.yearEndLines.map((line) => line.sheetRow)).toEqual([9, 11])
    expect(problemsOn(workbook, 'year-end')).toEqual([
      [2, 'year "last year" is not a year'],
      [3, '"notes" is not a statement. Use pl, balance, tax, distribution, grant, konto'],
      [4, '"turnover" is not a line of pl'],
      [5, 'no konto number in line'],
      [6, 'amount 10 reads as 1000%. Enter the rate as a percentage cell, such as 10%'],
      [7, 'amount "April" is not a date cell, and this line is a date'],
      [8, 'amount "lots" is not a number'],
      [9, 'categories is read on konto rows only, so it is ignored here'],
      [10, '2025 pl sales is already listed above'],
      [11, '"snacks" is not on the categories tab'],
    ])
  })

  it('warns on the total when the figures of a year do not add up, and keeps every line', () => {
    const workbook = workbookWith({
      'year-end': [
        header,
        [2025, 'pl', 'sales', '', 1000],
        [2025, 'pl', 'other-operating-income', '', 200],
        [2025, 'pl', 'material-costs', '', 300],
        [2025, 'pl', 'profit-before-tax', '', 950],
        [2025, 'balance', 'cash', '', 600],
        [2025, 'balance', 'tangible-assets', '', 400],
        [2025, 'balance', 'total-assets', '', 1000],
        [2025, 'balance', 'share-capital', '', 2500],
        [2025, 'balance', 'retained-earnings', '', -1500],
        [2025, 'balance', 'payables-taxes', '', 90],
        [2024, 'pl', 'sales', '', 100],
        [2024, 'pl', 'profit-before-tax', '', 100],
      ],
    })

    expect(workbook.yearEndLines).toHaveLength(12)
    expect(problemsOn(workbook, 'year-end')).toEqual([
      [5, '2025: income less expenses is 900.00, but profit-before-tax is 950.00, 50.00 apart'],
      [8, '2025: equity and liabilities add up to 1090.00, but total-assets is 1000.00, 90.00 apart'],
    ])
  })
})

describe('the plan tab', () => {
  const header = ['year', 'month', 'item', 'amount', 'note']

  it('reads amounts by keyword or category, a blank month as every month, and a scenario by name', () => {
    const workbook = workbookWith({
      scenarios: [['scenario', 'year', 'component', 'amount'], ['floor', 2027, 'salary_gross', 'floor']],
      plan: [
        header,
        [2027, '', 'Revenue', 7400, 'Rate rise'],
        [2027, 3, 'software', 12.5],
        [2027, '', 'owner_pay_scenario', 'Floor'],
        [2027, 6, 'dividend', 8000],
      ],
    })

    expect(workbook.planLines).toEqual([
      { year: 2027, month: null, note: 'Rate rise', sheetRow: 2, kind: 'amount', item: 'revenue', amount: 740000 },
      { year: 2027, month: 3, note: '', sheetRow: 3, kind: 'amount', item: 'software', amount: 1250 },
      { year: 2027, month: null, note: '', sheetRow: 4, kind: 'owner-pay-scenario', scenario: 'floor' },
      { year: 2027, month: 6, note: '', sheetRow: 5, kind: 'amount', item: 'dividend', amount: 800000 },
    ])
    expect(problemsOn(workbook, 'plan')).toEqual([])
  })

  it('leaves out a row it cannot plan with, and says why', () => {
    const workbook = workbookWith({
      plan: [
        header,
        [2027, 13, 'revenue', 1],
        [2027, '', 'snacks', 1],
        [2027, '', 'owner_pay_scenario', 'missing'],
        [2027, '', 'revenue', 'a lot'],
        [2027, '', 'revenue', 1],
        [2027, '', 'revenue', 2],
      ],
    })

    expect(workbook.planLines.map((line) => line.sheetRow)).toEqual([6])
    expect(problemsOn(workbook, 'plan')).toEqual([
      [2, 'month "13" is not a month from 1 to 12'],
      [3, '"snacks" is neither revenue, owner_pay_scenario, dividend, purchase nor a category on the categories tab'],
      [4, '"missing" is not a scenario on the scenarios tab'],
      [5, 'amount "a lot" is not a number'],
      [7, 'revenue for every month of 2027 is already listed above'],
    ])
  })
})

describe('the scenarios tab', () => {
  const header = ['scenario', 'label', 'year', 'component', 'amount', 'from', 'to']

  it('groups rows into scenarios for one year, each component with the days it holds', () => {
    const workbook = workbookWith({
      scenarios: [
        header,
        ['floor-then-board', 'Floor, then board only', 2027, 'salary_gross', 'Floor', '', DAY['2027-06-30']],
        ['floor-then-board', '', 2027, 'director_basis', 'board-only', DAY['2027-07-01']],
        ['floor-then-board', 'Ignored', 2027, 'nontaxable:gifts', 700],
        ['floor-then-board', '', 2027, 'salary_months', 6],
        ['salary', '', 2027, 'salary_gross', 2400.5],
        ['salary', '', 2027, 'rent_monthly', 300],
        ['salary', '', 2027, 'dividend', 'max'],
      ],
    })

    expect(workbook.payScenarios).toEqual([
      {
        slug: 'floor-then-board',
        label: 'Floor, then board only',
        year: 2027,
        components: [
          { from: null, to: '2027-06-30', sheetRow: 2, component: 'salary_gross', gross: 'floor' },
          { from: '2027-07-01', to: null, sheetRow: 3, component: 'director_basis', basis: 'board-only' },
          { from: null, to: null, sheetRow: 4, component: 'nontaxable', item: 'gifts', amount: 70000 },
          { from: null, to: null, sheetRow: 5, component: 'salary_months', months: 6 },
        ],
      },
      {
        slug: 'salary',
        label: '',
        year: 2027,
        components: [
          { from: null, to: null, sheetRow: 6, component: 'salary_gross', gross: 240050 },
          { from: null, to: null, sheetRow: 7, component: 'rent_monthly', amount: 30000 },
          { from: null, to: null, sheetRow: 8, component: 'dividend', amount: 'max' },
        ],
      },
    ])
    expect(problemsOn(workbook, 'scenarios')).toEqual([])
  })

  it('leaves out a row it cannot model, and says why', () => {
    const workbook = workbookWith({
      scenarios: [
        header,
        ['mix', '', 2027, 'salary_gross', 'floor'],
        ['mix', '', 2028, 'dividend', 'max'],
        ['mix', '', 2027, 'salary_gross', 'floor'],
        ['mix', '', 2027, 'bonus', 100],
        ['mix', '', 2027, 'nontaxable:', 100],
        ['mix', '', 2027, 'salary_months', 13],
        ['mix', '', 2027, 'director_basis', 'freelancer'],
        ['mix', '', 2027, 'dividend', -5],
        ['mix', '', 2027, 'rent_monthly', 300, DAY['2028-01-10']],
        ['mix', '', 2027, 'rent_monthly', 300, DAY['2027-07-01'], DAY['2027-01-15']],
        ['', '', 2027, 'rent_monthly', 300],
      ],
    })

    expect(workbook.payScenarios.map((scenario) => scenario.components.map((component) => component.sheetRow))).toEqual([[2]])
    expect(problemsOn(workbook, 'scenarios')).toEqual([
      [3, 'mix is a scenario for 2027 on an earlier row'],
      [4, 'mix already has this component for the same days above'],
      [5, '"bonus" is not a component. Use salary_gross, salary_months, rent_monthly, dividend, director_basis'],
      [6, '"" is not a tax-free item name, such as nontaxable:gifts'],
      [7, 'amount "13" is not a number of months from 0 to 12'],
      [8, '"freelancer" is not a director basis. Use employee, board-only, insured-elsewhere'],
      [9, 'amount "-5" is not an amount above zero or max'],
      [10, 'from 2028-01-10 is outside 2027'],
      [11, 'to 2027-01-15 is before from 2027-07-01'],
      [12, 'no scenario name'],
    ])
  })
})

describe('a Google Sheet', () => {
  it('reads the planning tabs it has, quoting a name with a hyphen, and lists the ones it lacks', async () => {
    const { assets, 'year-end': yearEnd, ...others } = fakeWorkbookValues('google')
    const withoutGrants = Object.fromEntries(Object.entries(others).filter(([tab]) => !['grants', 'plan', 'scenarios'].includes(tab)))
    const sheets = createFakeSheets({ ...withoutGrants, assets, 'year-end': yearEnd })

    const snapshot = await readSnapshotFrom(sheets, { id: 'sheet', name: 'Books' })

    expect(sheets.requests.find((request) => request.kind === 'batchGet')).toMatchObject({ ranges: expect.arrayContaining(['assets', "'year-end'"]) })
    expect(snapshot.meta.missingTabs).toEqual(['grants', 'plan', 'scenarios'])
    expect(snapshot.assets).toHaveLength(2)
    expect(readWorkbook(snapshot).yearEndLines.length).toBeGreaterThan(40)
  })
})
