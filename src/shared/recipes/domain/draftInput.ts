import type { DraftKind, TableRecipeDraft, TableRecipeFields } from './tableRecipeDraft'

/** A kind as an operation names it: the column it tests and the values that column holds, or null for any filled cell, or no column for every row. */
interface KindInput {
  readonly kind: string
  readonly column: string | null
  readonly equals: readonly string[] | null
}

function kindOf({ kind, column, equals }: KindInput): DraftKind {
  if (column === null) return { kind, test: null }
  return { kind, test: equals === null ? { column, filled: true } : { column, is: equals } }
}

/** The draft an operation's input writes, which `tableRecipeInput`'s schema checked. A debit and credit pair stands in for a blank amount column. */
export function draftOfInput(input: Readonly<Record<string, never>>): TableRecipeDraft {
  const columns: Readonly<Record<string, string | null>> = input['columns']
  const amount: string | null = input['amountColumn']
  return {
    name: input['name'],
    date: { column: input['dateColumn'], format: input['dateFormat'] },
    amount: amount === null ? { debit: input['debitColumn'] ?? '', credit: input['creditColumn'] ?? '' } : { column: amount },
    mark: input['decimalMark'],
    columns: Object.fromEntries(Object.entries(columns).flatMap(([field, column]) => (column === null ? [] : [[field, column]]))),
    kinds: (input['kinds'] as readonly KindInput[]).map(kindOf),
  }
}

/** A draft as an operation's input writes it, for a reader that hands the model a recipe to change. */
export function inputOfDraft(draft: TableRecipeDraft, fields: TableRecipeFields): Readonly<Record<string, unknown>> {
  const pair = 'debit' in draft.amount ? draft.amount : null
  return {
    name: draft.name,
    dateColumn: draft.date.column,
    dateFormat: draft.date.format,
    amountColumn: 'column' in draft.amount ? draft.amount.column : null,
    debitColumn: pair?.debit ?? null,
    creditColumn: pair?.credit ?? null,
    decimalMark: draft.mark,
    columns: Object.fromEntries(fields.optional.map(({ field }) => [field, draft.columns[field] ?? null])),
    kinds: draft.kinds.map(({ kind, test }) => ({ kind, column: test?.column ?? null, equals: test === null || 'filled' in test ? null : test.is })),
  }
}
