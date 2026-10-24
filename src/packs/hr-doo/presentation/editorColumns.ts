import type { ChoiceItem, EditorColumn } from '../../../features/settings/presentation/factTabColumns'
import type { DraftFieldKind, FieldReader } from '../../../features/settings/domain/recordDrafts'
import { ASSET_GROUPS } from '../domain/assets/assets'
import { GRANT_RELEASES } from '../domain/grants/grants'
import { YEAR_END_LINES, YEAR_END_STATEMENTS, yearEndLineDefinition } from '../domain/yearEnd/yearEnd'
import type { YearEndFigureKind, YearEndStatement } from '../domain/yearEnd/yearEnd'

function choicesFrom(words: readonly string[]): ChoiceItem[] {
  return words.map((word) => ({ value: word, label: word }))
}

/** The assets tab, with the grants an asset can be funded by. */
export function assetColumns(grantSlugs: readonly string[]): readonly EditorColumn[] {
  return [
    { name: 'asset', label: 'Asset', kind: 'text', width: 'w-44' },
    { name: 'bought', label: 'Bought', kind: 'date', width: 'w-40' },
    { name: 'in_use', label: 'In use from', kind: 'date', width: 'w-40', placeholderOf: (fieldOf) => fieldOf('bought') },
    { name: 'cost_net', label: 'Cost without VAT', kind: 'amount', width: 'w-32' },
    { name: 'group', label: 'Group', kind: 'word', width: 'w-36', choices: choicesFrom(ASSET_GROUPS) },
    { name: 'doubled', label: 'Doubled rate', kind: 'flag', width: 'w-32' },
    { name: 'disposed', label: 'Disposed', kind: 'date', width: 'w-40' },
    { name: 'funded_by', label: 'Funded by', kind: 'word', width: 'w-40', choices: choicesFrom(grantSlugs), blankLabel: 'No grant' },
    { name: 'ledger_reference', label: 'Ledger reference', kind: 'text', width: 'w-44' },
    { name: 'note', label: 'Note', kind: 'text', width: 'w-56' },
  ]
}

export const GRANT_COLUMNS: readonly EditorColumn[] = [
  { name: 'grant', label: 'Grant', kind: 'word', width: 'w-40' },
  { name: 'received', label: 'Received', kind: 'date', width: 'w-40' },
  { name: 'amount', label: 'Amount', kind: 'amount', width: 'w-32' },
  { name: 'fixed_part', label: 'Fixed part', kind: 'amount', width: 'w-32' },
  { name: 'variable_part', label: 'Variable part', kind: 'amount', width: 'w-32' },
  { name: 'period_from', label: 'Period from', kind: 'date', width: 'w-40' },
  { name: 'period_to', label: 'Period to', kind: 'date', width: 'w-40' },
  { name: 'release', label: 'Release', kind: 'word', width: 'w-48', choices: choicesFrom(GRANT_RELEASES), blankLabel: 'Blank, fixed-then-assets' },
  { name: 'clawback_year1', label: 'Clawback, year 1', kind: 'amount-or-word', width: 'w-32', placeholderOf: () => 'whole or amount' },
  { name: 'clawback_year2', label: 'Clawback, year 2', kind: 'amount-or-word', width: 'w-32', placeholderOf: () => 'whole or amount' },
  { name: 'employment_required_until', label: 'Employment until', kind: 'date', width: 'w-40' },
  { name: 'note', label: 'Note', kind: 'text', width: 'w-56' },
]

const FIGURE_FIELD_KINDS: Readonly<Record<YearEndFigureKind, DraftFieldKind>> = { money: 'amount', date: 'date', rate: 'percent', count: 'whole-number' }

function definitionOf(fieldOf: FieldReader): ReturnType<typeof yearEndLineDefinition> {
  const statement = fieldOf('statement')
  return (YEAR_END_STATEMENTS as readonly string[]).includes(statement) ? yearEndLineDefinition(statement as YearEndStatement, fieldOf('line')) : null
}

export const YEAR_END_COLUMNS: readonly EditorColumn[] = [
  { name: 'year', label: 'Year', kind: 'whole-number', width: 'w-24' },
  { name: 'statement', label: 'Statement', kind: 'word', width: 'w-36', choices: choicesFrom(YEAR_END_STATEMENTS) },
  {
    name: 'line',
    label: 'Line',
    kind: 'word',
    width: 'w-64',
    kindOf: (fieldOf) => (fieldOf('statement') === 'konto' ? 'text' : 'word'),
    choicesOf: (fieldOf) => {
      const statement = fieldOf('statement')
      return statement === 'konto'
        ? null
        : YEAR_END_LINES.filter((definition) => definition.statement === statement).map((definition) => ({ value: definition.line, label: `${definition.line} · ${definition.hint}` }))
    },
    placeholderOf: (fieldOf) => (fieldOf('statement') === 'konto' ? 'Konto number' : 'Choose'),
  },
  { name: 'label', label: 'As printed', kind: 'text', width: 'w-56', placeholderOf: (fieldOf) => definitionOf(fieldOf)?.hint ?? '' },
  {
    name: 'amount',
    label: 'Amount',
    kind: 'amount',
    width: 'w-36',
    kindOf: (fieldOf) => FIGURE_FIELD_KINDS[definitionOf(fieldOf)?.kind ?? 'money'],
  },
  { name: 'categories', label: 'Categories', kind: 'text', width: 'w-48', placeholderOf: (fieldOf) => (fieldOf('statement') === 'konto' ? 'Comma separated' : '') },
  { name: 'aop', label: 'AOP', kind: 'text', width: 'w-24' },
  { name: 'source', label: 'Source', kind: 'text', width: 'w-44' },
  { name: 'note', label: 'Note', kind: 'text', width: 'w-56' },
]
