import type { DraftColumn, FieldReader } from '../domain/recordDrafts'
import { words } from './words'

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

/** The clients tab, one row per client with every IBAN it pays from. */
export const CLIENT_COLUMNS: readonly EditorColumn[] = [
  { name: 'client', label: words.clientColumns.client, kind: 'word', width: 'w-36' },
  { name: 'name', label: words.clientColumns.name, kind: 'text', width: 'w-48' },
  { name: 'iban', label: words.clientColumns.iban, kind: 'iban-list', width: 'w-72' },
  { name: 'address', label: words.clientColumns.address, kind: 'text', width: 'w-56' },
  { name: 'country', label: words.clientColumns.country, kind: 'text', width: 'w-36' },
  { name: 'tax_id', label: words.clientColumns.tax_id, kind: 'text', width: 'w-36' },
  { name: 'invoice_mail', label: words.clientColumns.invoice_mail, kind: 'text', width: 'w-56' },
  { name: 'mail_language', label: words.clientColumns.mail_language, kind: 'text', width: 'w-28', placeholderOf: () => 'en' },
  { name: 'reverse_charge', label: words.clientColumns.reverse_charge, kind: 'flag', width: 'w-32' },
]
