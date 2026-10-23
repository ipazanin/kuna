import type { DraftColumn, FieldReader } from '../domain/recordDrafts'

export interface ChoiceItem {
  readonly value: string
  readonly label: string
}

/** One column of a tab editor: how its cell is typed, and how the field looks. */
export interface EditorColumn extends DraftColumn {
  readonly label: string
  /** A Tailwind width class for the field. */
  readonly width: string
  readonly choices?: readonly ChoiceItem[]
  /** Choices that follow the rest of the row. Null gives a free text field. */
  readonly choicesOf?: (fieldOf: FieldReader) => readonly ChoiceItem[] | null
  /** When set, the choice may stay blank, and this is what the blank choice says. */
  readonly blankLabel?: string
  readonly placeholderOf?: (fieldOf: FieldReader) => string
}

/** The clients tab, one row per IBAN a client pays from. */
export const CLIENT_COLUMNS: readonly EditorColumn[] = [
  { name: 'client', label: 'Client', kind: 'word', width: 'w-36' },
  { name: 'name', label: 'Name', kind: 'text', width: 'w-48' },
  { name: 'iban', label: 'IBAN', kind: 'iban', width: 'w-64' },
  { name: 'address', label: 'Address', kind: 'text', width: 'w-56' },
  { name: 'country', label: 'Country', kind: 'text', width: 'w-36' },
  { name: 'tax_id', label: 'Tax ID', kind: 'text', width: 'w-36' },
  { name: 'invoice_mail', label: 'Invoice mail to', kind: 'text', width: 'w-56' },
  { name: 'mail_language', label: 'Mail language', kind: 'text', width: 'w-28', placeholderOf: () => 'en' },
  { name: 'reverse_charge', label: 'Reverse charge', kind: 'flag', width: 'w-32' },
]
