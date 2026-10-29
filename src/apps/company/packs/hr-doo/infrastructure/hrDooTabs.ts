import { byColumn } from '../../../workbook/infrastructure/cellFormats'
import type { CellFormat } from '../../../workbook/infrastructure/cellFormats'
import type { PackSpreadsheetTab } from '../../../workbook/infrastructure/packTabs'
import { ID_TEMPLATE_COLUMN, OWNER_SHARE_TEMPLATE_COLUMN } from '../../../workbook/infrastructure/workbookTemplate'
import type { TemplateColumn } from '../../../workbook/infrastructure/workbookTemplate'
import { ASSET_GROUPS } from '../domain/assets/assets'
import type { Asset } from '../domain/assets/assets'
import type { Employee } from '../domain/employees/employees'
import type { PlanLine } from '../domain/forecast/plan'
import { GRANT_RELEASES } from '../domain/grants/grants'
import type { Grant } from '../domain/grants/grants'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'
import { ASSET_RECORDS, EMPLOYEE_RECORDS, GRANT_RECORDS, OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS } from '../domain/hrDooKinds'
import { DIRECTOR_BASES } from '../domain/scenarios/ownerPayScenarios'
import type { ScenarioRow } from '../domain/scenarios/scenariosReading'
import { YEAR_END_STATEMENTS, yearEndLineDefinition } from '../domain/yearEnd/yearEnd'
import type { YearEndFigureKind, YearEndLine, YearEndStatement } from '../domain/yearEnd/yearEnd'

const OWNER_ADVANCE_COLUMNS: readonly TemplateColumn[] = [
  { name: 'date', note: 'When the owner paid, as a date cell. Required.' },
  {
    name: 'amount',
    note: "What the owner paid for the company, as a number above zero. Required. The owner's private share of a company payment goes on the splits tab.",
  },
  { name: 'description', note: 'What it was for. Optional.' },
  { name: 'category', note: 'A category from the categories tab in the operating or taxes bucket. The cost counts there on its date. Required.' },
  OWNER_SHARE_TEMPLATE_COLUMN,
  ID_TEMPLATE_COLUMN,
]

const ASSET_COLUMNS: readonly TemplateColumn[] = [
  { name: 'asset', note: 'What was bought, such as Laptop 14 inch. Each asset once. Required.' },
  { name: 'bought', note: 'The purchase date, as a date cell. Required.' },
  { name: 'in_use', note: 'The day it was put in use, as a date cell. Depreciation starts the month after. Blank means the day it was bought.' },
  { name: 'cost_net', note: 'The cost without the VAT that was reclaimed, as a number above zero. Required.' },
  { name: 'group', note: `The depreciation group: ${ASSET_GROUPS.join(', ')}. Required.` },
  { name: 'doubled', note: 'TRUE when the depreciation rate is doubled for this asset. Blank or FALSE uses the single rate.' },
  { name: 'disposed', note: 'The day it was sold or written off, as a date cell. Blank while you still have it.' },
  { name: 'funded_by', note: 'The grant that paid for it, by the name in the grants tab. Optional.' },
  { name: 'ledger_reference', note: 'Text that finds the purchase on the ledger, such as its bank reference. Optional.' },
  { name: 'note', note: 'Anything worth keeping with it. Optional.' },
  ID_TEMPLATE_COLUMN,
]

const GRANT_COLUMNS: readonly TemplateColumn[] = [
  { name: 'grant', note: 'A short name in lower case, such as startup-grant. Each grant once. Required.' },
  { name: 'received', note: 'The day the money arrived, as a date cell. Required.' },
  { name: 'amount', note: 'The whole grant, as a number above zero. Required.' },
  { name: 'fixed_part', note: 'The part that is income when received, as a number. Fill it with variable_part, and the two add up to amount.' },
  { name: 'variable_part', note: 'The part that pays for assets and counts as income with their depreciation, as a number.' },
  { name: 'period_from', note: 'The first day the grant covers, as a date cell. Optional, with period_to.' },
  { name: 'period_to', note: 'The last day the grant covers, as a date cell. Optional, with period_from.' },
  {
    name: 'release',
    note:
      `How the grant counts as income: ${GRANT_RELEASES.join(' or ')}. Blank means fixed-then-assets, which needs both parts. ` +
      'straight-line spreads the amount over the period and needs both period dates.',
  },
  { name: 'clawback_year1', note: 'What the grantor can claim back in the first year: whole, or an amount. Optional.' },
  { name: 'clawback_year2', note: 'What the grantor can claim back in the second year: whole, or an amount. Optional.' },
  { name: 'employment_required_until', note: 'The day until which the grant requires your employment, as a date cell. Optional.' },
  { name: 'note', note: 'Anything worth keeping with it. Optional.' },
]

const YEAR_END_COLUMNS: readonly TemplateColumn[] = [
  { name: 'year', note: 'The financial year, such as 2025. Required.' },
  { name: 'statement', note: `Where the figure comes from: ${YEAR_END_STATEMENTS.join(', ')}. Required.` },
  {
    name: 'line',
    note: 'The line id, such as sales, total-assets or liability. On a konto row, the account number, such as 41110. Each year, statement and line once. Required.',
  },
  { name: 'label', note: 'The line as the accountant printed it. Optional.' },
  {
    name: 'amount',
    note: 'The figure as printed, costs as positive numbers. A date line such as filed-on takes a date cell, rate a percentage cell such as 10%, and months-of-operation a whole number. Required.',
  },
  { name: 'categories', note: 'On a konto row, the app categories the account matches, comma separated. Optional, and ignored on other rows.' },
  { name: 'aop', note: 'The AOP code of the line on the official form, when the package has one. Optional.' },
  { name: 'source', note: 'The file the figure was read from. Optional.' },
  { name: 'note', note: 'Anything worth keeping with it. Optional.' },
  ID_TEMPLATE_COLUMN,
]

const PLAN_COLUMNS: readonly TemplateColumn[] = [
  { name: 'year', note: 'The year planned, such as 2027. Required.' },
  {
    name: 'month',
    note: 'The month from 1 to 12. Blank means every month of the year. A dividend needs its month, and owner_pay_scenario and purchase rows leave it blank, since their date sets it.',
  },
  {
    name: 'item',
    note: 'A category from the categories tab, owner_pay_scenario, dividend or purchase. A category or a dividend once per year and month, and one dividend a year. Planned revenue goes on the outgoing-plan tab. Required.',
  },
  {
    name: 'amount',
    note: 'The amount planned for the month as a positive number, a cost without the VAT that is reclaimed. On a purchase, its net cost. On an owner_pay_scenario row, the name of a scenario of the same year from the scenarios tab. Required.',
  },
  { name: 'note', note: 'Why you expect it, or what a purchase is. Optional.' },
  {
    name: 'date',
    note: 'On a purchase, the day it is bought and put in use, as a date cell. Required there. On an owner_pay_scenario row, the day a second scenario takes over from the one without a date.',
  },
  { name: 'group', note: `On a purchase, its depreciation group: ${ASSET_GROUPS.join(', ')}. Required there.` },
  ID_TEMPLATE_COLUMN,
]

const SCENARIO_COLUMNS: readonly TemplateColumn[] = [
  { name: 'scenario', note: 'A short name in lower case. The rows that share it make one owner pay scenario. Required.' },
  { name: 'label', note: 'What the screens call the scenario. Optional. Rows of one scenario that give it differently read blank.' },
  { name: 'year', note: 'The year the scenario is for. Every row of a scenario has the same year. Required.' },
  {
    name: 'component',
    note: 'salary_gross, nontaxable:<item> such as nontaxable:occasional-gift, rent_monthly, dividend or director_basis. Required.',
  },
  {
    name: 'amount',
    note: `A number above zero: a month's gross salary or rent, or a year's tax-free item or dividend. salary_gross also takes floor, dividend also takes max, and director_basis takes ${DIRECTOR_BASES.join(', ')}. Required.`,
  },
  { name: 'from', note: 'The first day it holds, as a date cell in the scenario year. Blank means the start of the year.' },
  { name: 'to', note: 'The last day it holds, as a date cell in the scenario year. Blank means the end of the year.' },
]

const EMPLOYEE_COLUMNS: readonly TemplateColumn[] = [
  { name: 'employee', note: 'A short name in lower case, such as alex. Each employee once. Required.' },
  { name: 'name', note: 'The full name. Optional.' },
  {
    name: 'residence_city',
    note: 'The city or municipality the employee lives in, such as Zagreb, which sets the local income tax rates. The payroll leaves the employee out while it is blank.',
  },
  { name: 'pension_pillar_2', note: 'TRUE when the employee pays into the second pension pillar. Blank or FALSE sends the whole pension contribution to the first.' },
  { name: 'dependants', note: 'How many dependants raise the personal allowance, a whole number from 0 to 20. Blank means 0.' },
  { name: 'birth_year', note: 'The year of birth, such as 1990, for the youth income tax relief. Blank means no relief is assumed.' },
  { name: 'from', note: 'The first day of the employment, as a date cell. A month it starts or ends in counts its working days from here. Required.' },
  { name: 'to', note: 'The last day of the employment, as a date cell. Blank while it lasts.' },
  {
    name: 'director',
    note: "TRUE for a member of the company who is its director, whose salary has the director floor. One row at most. The pay scenarios and the forecast work out the owner's pay on it.",
  },
]

const FIGURE_FORMATS: Readonly<Record<YearEndFigureKind, CellFormat>> = { money: 'amount', date: 'date', rate: 'rate', count: 'count' }

export const OWNER_ADVANCES_TAB: PackSpreadsheetTab<OwnerAdvanceEntry> = {
  tab: 'owner-advances',
  kind: OWNER_ADVANCE_RECORDS,
  formatOf: byColumn({ date: 'date', amount: 'amount', owner_share: 'number' }),
  columns: OWNER_ADVANCE_COLUMNS,
}

export const ASSETS_TAB: PackSpreadsheetTab<Asset> = {
  tab: 'assets',
  kind: ASSET_RECORDS,
  formatOf: byColumn({ bought: 'date', in_use: 'date', cost_net: 'amount', disposed: 'date' }),
  columns: ASSET_COLUMNS,
}

export const GRANTS_TAB: PackSpreadsheetTab<Grant> = {
  tab: 'grants',
  kind: GRANT_RECORDS,
  formatOf: byColumn({
    received: 'date',
    amount: 'amount',
    fixed_part: 'amount',
    variable_part: 'amount',
    period_from: 'date',
    period_to: 'date',
    clawback_year1: 'amount',
    clawback_year2: 'amount',
    employment_required_until: 'date',
  }),
  columns: GRANT_COLUMNS,
}

/** The `year-end` amount holds a date, a rate or a count on some lines, so its format follows the record's line. */
export const YEAR_END_TAB: PackSpreadsheetTab<YearEndLine> = {
  tab: 'year-end',
  kind: YEAR_END_RECORDS,
  formatOf: (column, fieldOf) => {
    if (column === 'year') {
      return 'number'
    }
    if (column !== 'amount') {
      return null
    }
    const statement = fieldOf('statement')
    const definition = (YEAR_END_STATEMENTS as readonly string[]).includes(statement) ? yearEndLineDefinition(statement as YearEndStatement, fieldOf('line')) : null
    return FIGURE_FORMATS[definition?.kind ?? 'money']
  },
  columns: YEAR_END_COLUMNS,
}

const PLAN_FORMATS = byColumn({ year: 'number', month: 'number', amount: 'amount', date: 'date' })

/** An `owner_pay_scenario` line names its scenario in `amount`, so its amount stays text. */
export const PLAN_TAB: PackSpreadsheetTab<PlanLine> = {
  tab: 'plan',
  kind: PLAN_RECORDS,
  formatOf: (column, fieldOf) => (column === 'amount' && fieldOf('item') === 'owner_pay_scenario' ? null : PLAN_FORMATS(column, fieldOf)),
  columns: PLAN_COLUMNS,
}

export const SCENARIOS_TAB: PackSpreadsheetTab<ScenarioRow> = {
  tab: 'scenarios',
  kind: SCENARIO_RECORDS,
  formatOf: byColumn({ year: 'number', amount: 'amount', from: 'date', to: 'date' }),
  columns: SCENARIO_COLUMNS,
}

export const EMPLOYEES_TAB: PackSpreadsheetTab<Employee> = {
  tab: 'employees',
  kind: EMPLOYEE_RECORDS,
  formatOf: byColumn({ dependants: 'number', birth_year: 'number', from: 'date', to: 'date' }),
  columns: EMPLOYEE_COLUMNS,
}

/** The pack's tabs, which the company app installs with the spreadsheet adapter. */
export const HR_DOO_TABS: readonly PackSpreadsheetTab<unknown>[] = [OWNER_ADVANCES_TAB, ASSETS_TAB, GRANTS_TAB, YEAR_END_TAB, PLAN_TAB, SCENARIOS_TAB, EMPLOYEES_TAB]
