import type { ChoiceItem, EditorColumn } from '../../../settings/presentation/factTabColumns'
import type { DraftFieldKind, FieldReader } from '../../../settings/domain/recordDrafts'
import { ASSET_GROUPS } from '../domain/assets/assets'
import { GRANT_RELEASES } from '../domain/grants/grants'
import { YEAR_END_LINES, YEAR_END_STATEMENTS, yearEndLineDefinition } from '../domain/yearEnd/yearEnd'
import type { YearEndFigureKind, YearEndStatement } from '../domain/yearEnd/yearEnd'
import { words } from './words'

function choicesFrom(choices: readonly string[]): ChoiceItem[] {
  return choices.map((choice) => ({ value: choice, label: choice }))
}

/** The assets tab, with the grants an asset can be funded by. */
export function assetColumns(grantSlugs: readonly string[]): readonly EditorColumn[] {
  return [
    { name: 'asset', label: words.assetColumns.asset, kind: 'text', width: 'w-44' },
    { name: 'bought', label: words.assetColumns.bought, kind: 'date', width: 'w-40' },
    { name: 'in_use', label: words.assetColumns.in_use, kind: 'date', width: 'w-40', placeholderOf: (fieldOf) => fieldOf('bought') },
    { name: 'cost_net', label: words.assetColumns.cost_net, kind: 'amount', width: 'w-32' },
    { name: 'group', label: words.assetColumns.group, kind: 'word', width: 'w-36', choices: choicesFrom(ASSET_GROUPS) },
    { name: 'doubled', label: words.assetColumns.doubled, kind: 'flag', width: 'w-32' },
    { name: 'disposed', label: words.assetColumns.disposed, kind: 'date', width: 'w-40' },
    { name: 'funded_by', label: words.assetColumns.funded_by, kind: 'word', width: 'w-40', choices: choicesFrom(grantSlugs), blankLabel: words.assetColumns.noGrant },
    { name: 'ledger_reference', label: words.assetColumns.ledger_reference, kind: 'text', width: 'w-44' },
    { name: 'note', label: words.assetColumns.note, kind: 'text', width: 'w-56' },
  ]
}

export const GRANT_COLUMNS: readonly EditorColumn[] = [
  { name: 'grant', label: words.grantColumns.grant, kind: 'word', width: 'w-40' },
  { name: 'received', label: words.grantColumns.received, kind: 'date', width: 'w-40' },
  { name: 'amount', label: words.grantColumns.amount, kind: 'amount', width: 'w-32' },
  { name: 'fixed_part', label: words.grantColumns.fixed_part, kind: 'amount', width: 'w-32' },
  { name: 'variable_part', label: words.grantColumns.variable_part, kind: 'amount', width: 'w-32' },
  { name: 'period_from', label: words.grantColumns.period_from, kind: 'date', width: 'w-40' },
  { name: 'period_to', label: words.grantColumns.period_to, kind: 'date', width: 'w-40' },
  { name: 'release', label: words.grantColumns.release, kind: 'word', width: 'w-48', choices: choicesFrom(GRANT_RELEASES), blankLabel: words.grantColumns.blankRelease },
  { name: 'clawback_year1', label: words.grantColumns.clawback_year1, kind: 'amount-or-word', width: 'w-32', placeholderOf: () => words.grantColumns.clawbackPlaceholder },
  { name: 'clawback_year2', label: words.grantColumns.clawback_year2, kind: 'amount-or-word', width: 'w-32', placeholderOf: () => words.grantColumns.clawbackPlaceholder },
  { name: 'employment_required_until', label: words.grantColumns.employment_required_until, kind: 'date', width: 'w-40' },
  { name: 'note', label: words.grantColumns.note, kind: 'text', width: 'w-56' },
]

const FIGURE_FIELD_KINDS: Readonly<Record<YearEndFigureKind, DraftFieldKind>> = { money: 'amount', date: 'date', rate: 'percent', count: 'whole-number' }

function definitionOf(fieldOf: FieldReader): ReturnType<typeof yearEndLineDefinition> {
  const statement = fieldOf('statement')
  return (YEAR_END_STATEMENTS as readonly string[]).includes(statement) ? yearEndLineDefinition(statement as YearEndStatement, fieldOf('line')) : null
}

export const YEAR_END_COLUMNS: readonly EditorColumn[] = [
  { name: 'year', label: words.yearEndColumns.year, kind: 'whole-number', width: 'w-24' },
  {
    name: 'statement',
    label: words.yearEndColumns.statement,
    kind: 'word',
    width: 'w-36',
    choices: YEAR_END_STATEMENTS.map((statement) => ({ value: statement, label: words.yearEndColumns.statements[statement] })),
  },
  {
    name: 'line',
    label: words.yearEndColumns.line,
    kind: 'word',
    width: 'w-64',
    kindOf: (fieldOf) => (fieldOf('statement') === 'konto' ? 'text' : 'word'),
    choicesOf: (fieldOf) => {
      const statement = fieldOf('statement')
      return statement === 'konto'
        ? null
        : YEAR_END_LINES.filter((definition) => definition.statement === statement).map((definition) => ({ value: definition.line, label: `${definition.line} · ${definition.hint}` }))
    },
    placeholderOf: (fieldOf) => (fieldOf('statement') === 'konto' ? words.yearEndColumns.kontoNumber : words.yearEndColumns.choose),
  },
  { name: 'label', label: words.yearEndColumns.label, kind: 'text', width: 'w-56', placeholderOf: (fieldOf) => definitionOf(fieldOf)?.hint ?? '' },
  {
    name: 'amount',
    label: words.yearEndColumns.amount,
    kind: 'amount',
    width: 'w-36',
    kindOf: (fieldOf) => FIGURE_FIELD_KINDS[definitionOf(fieldOf)?.kind ?? 'money'],
  },
  {
    name: 'categories',
    label: words.yearEndColumns.categories,
    kind: 'text',
    width: 'w-48',
    placeholderOf: (fieldOf) => (fieldOf('statement') === 'konto' ? words.yearEndColumns.commaSeparated : ''),
  },
  { name: 'aop', label: words.yearEndColumns.aop, kind: 'text', width: 'w-24' },
  { name: 'source', label: words.yearEndColumns.source, kind: 'text', width: 'w-44' },
  { name: 'note', label: words.yearEndColumns.note, kind: 'text', width: 'w-56' },
]

export const EMPLOYEE_COLUMNS: readonly EditorColumn[] = [
  { name: 'employee', label: words.employeeColumns.employee, kind: 'word', width: 'w-32' },
  { name: 'name', label: words.employeeColumns.name, kind: 'text', width: 'w-48', placeholderOf: () => words.employeeColumns.namePlaceholder },
  { name: 'iban', label: words.employeeColumns.iban, kind: 'iban-list', width: 'w-72' },
  { name: 'residence_city', label: words.employeeColumns.residence_city, kind: 'text', width: 'w-44', placeholderOf: () => words.employeeColumns.cityPlaceholder },
  { name: 'pension_pillar_2', label: words.employeeColumns.pension_pillar_2, kind: 'flag', width: 'w-28' },
  { name: 'dependants', label: words.employeeColumns.dependants, kind: 'whole-number', width: 'w-24', placeholderOf: () => '0' },
  { name: 'birth_year', label: words.employeeColumns.birth_year, kind: 'whole-number', width: 'w-28' },
  { name: 'agreed_gross', label: words.employeeColumns.agreed_gross, kind: 'amount', width: 'w-32' },
  { name: 'from', label: words.employeeColumns.from, kind: 'date', width: 'w-40' },
  { name: 'to', label: words.employeeColumns.to, kind: 'date', width: 'w-40' },
  { name: 'director', label: words.employeeColumns.director, kind: 'flag', width: 'w-28' },
]
