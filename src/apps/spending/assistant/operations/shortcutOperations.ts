import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { addEntryFromShortcut, addShortcut, changeShortcut, deleteShortcut, moveShortcut, newShortcut } from '../../shortcuts/application/shortcutWrites'
import { shortcutDraftOf, shortcutPartProblem, shortcutsShown } from '../../shortcuts/domain/shortcuts'
import type { ShortcutDraft, ShortcutPartProblem, ShortcutWithParts } from '../../shortcuts/domain/shortcuts'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { takesNewRowsByHand } from '../../workbook/domain/account'
import { itemizedRow } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, SHORTCUT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import { absAccountMoney, accountMoneyFromAmount, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const KIND: StrictSchema = { type: 'string', enum: ['out', 'in'], description: 'out for money out, in for money in.' }
const PARTS: StrictSchema = { type: 'array', items: inputOf({ amount: NUMBER, category: TEXT, note: TEXT }) }

/** What Quick add on Entries and Settings, Quick add do: make, change, move and delete a quick add, and write its entry. */
export const SHORTCUT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-shortcut',
    about: [
      'A new quick add: a button on Entries that writes the same typed entry for today in one tap, such as the morning coffee in cash.',
      "With entry, it is made from that entry, its account, payee and parts, every other field but name is null and parts is []. Otherwise account, payee, kind and parts give it. Each part's amount is above zero in the account's currency, and kind signs them all.",
      'Two parts or more write one entry split into them, such as a coffee and its tip. A part goes under any category a row may take, but never under a group with categories under it or under Between my accounts. name is what the button says, or "" to show the payee.',
    ].join(' '),
    input: inputOf({ entry: TEXT_OR_NULL, name: TEXT, account: TEXT_OR_NULL, payee: TEXT_OR_NULL, kind: { ...KIND, type: ['string', 'null'], enum: ['out', 'in', null] }, parts: PARTS }),
    refs: { entry: TRANSACTION_RECORDS.name, account: ACCOUNT_RECORDS.name, 'parts.category': CATEGORY_RECORDS.name },
    creates: SHORTCUT_RECORDS.name,
    alone: false,
    example: { entry: null, name: 'Coffee', account: 'account', payee: 'A café', kind: 'out', parts: [{ amount: 1.8, category: 'category', note: '' }] },
  },
  {
    name: 'change-shortcut',
    about:
      'A new name, account, payee, way or parts for a quick add. Null leaves a field as it is, and parts [] keeps its parts. Given parts take the place of all of its parts, with no labels, which Settings, Quick add sets. A new way signs every part again. Entries it already wrote stay as they are.',
    input: inputOf({ shortcut: TEXT, name: TEXT_OR_NULL, account: TEXT_OR_NULL, payee: TEXT_OR_NULL, kind: { ...KIND, type: ['string', 'null'], enum: ['out', 'in', null] }, parts: PARTS }),
    refs: { shortcut: SHORTCUT_RECORDS.name, account: ACCOUNT_RECORDS.name, 'parts.category': CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { shortcut: 'shortcut', name: null, account: null, payee: null, kind: null, parts: [{ amount: 2, category: 'category', note: '' }] },
  },
  {
    name: 'move-shortcut',
    about: 'Moves a quick add one place up or down among the buttons on Entries.',
    input: inputOf({ shortcut: TEXT, direction: { type: 'string', enum: ['up', 'down'] } }),
    refs: { shortcut: SHORTCUT_RECORDS.name },
    creates: null,
    alone: false,
    example: { shortcut: 'shortcut', direction: 'down' },
  },
  {
    name: 'delete-shortcut',
    about: 'Deletes a quick add. The entries it wrote stay.',
    input: inputOf({ shortcut: TEXT }),
    refs: { shortcut: SHORTCUT_RECORDS.name },
    creates: null,
    alone: false,
    example: { shortcut: 'shortcut' },
  },
  {
    name: 'use-shortcut',
    about:
      'Writes the entry a quick add writes, as its button does, when the person says they had it, such as "I had my coffee". date is null for today. amount is null for its own, or what it was this time, above zero, for a quick add of one part. A later step names the entry by its $ name.',
    input: inputOf({ shortcut: TEXT, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL }),
    refs: { shortcut: SHORTCUT_RECORDS.name },
    creates: TRANSACTION_RECORDS.name,
    alone: false,
    example: { shortcut: 'shortcut', date: null, amount: null },
  },
]

const SHORTCUT_OPERATION_NAMES: ReadonlySet<string> = new Set(SHORTCUT_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the quick add operations. */
export function isShortcutStep(operation: string): boolean {
  return SHORTCUT_OPERATION_NAMES.has(operation)
}

const REFUSALS: Readonly<Record<ShortcutPartProblem, string>> = {
  zero: 'Each part needs an amount above zero.',
  'mixed-ways': 'Every part of a quick add goes the same way.',
  'unknown-category': 'A part names a category that is not in the file.',
  'between-accounts': 'A quick add never writes Between my accounts. add-transfer moves money between two accounts.',
  'unknown-label': 'A part names a label that is not in the file.',
}

/** The step's quick add with its parts as the book holds them. */
function heldShortcut(book: SpendingBook, ref: unknown, idOf: (value: unknown) => string): ShortcutWithParts {
  const shortcut = found(book.shortcuts, idOf(ref), 'quick add')
  return { shortcut, parts: book.shortcutParts.filter((part) => part.shortcut === shortcut.id) }
}

/** The draft refused with the chat's words when an account or a part cannot take it, as the reader would. */
function checked(book: SpendingBook, draft: ShortcutDraft): ShortcutDraft {
  const account = found(book.accounts, draft.account, 'account')
  if (!takesNewRowsByHand(account)) throw new StepRefused('A quick add goes on an open account whose rows you type, never one that is closed or one the bank fills.')
  if (draft.parts.length === 0) throw new StepRefused('A quick add needs at least one part.')
  const problem = draft.parts.map((part) => shortcutPartProblem(part, draft.parts, book)).find((found) => found !== null) ?? null
  if (problem !== null) throw new StepRefused(REFUSALS[problem])
  return draft
}

/**
 * Writes a quick add step through the writes Settings and Entries use, and gives what an add-shortcut or use-shortcut step made
 * so a later step names it by `$`.
 */
export function writeShortcutStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): { readonly shortcut: ShortcutWithParts } | { readonly entry: ItemizedRow } | null {
  const partsOf = (kind: 'out' | 'in', given: readonly { readonly amount: number; readonly category: string; readonly note: string }[]): ShortcutDraft['parts'] =>
    given.map((part) => {
      const amount = absAccountMoney(accountMoneyFromAmount(part.amount))
      return { amount: kind === 'out' ? negateAccountMoney(amount) : amount, category: found(book.categories, idOf(part.category), 'category').id, note: part.note, labels: [] }
    })
  const kindOf = (value: string | null): 'out' | 'in' | null => choiceOf(['out', 'in'], value, 'kind')
  switch (operation) {
    case 'add-shortcut': {
      const fromEntry = field['entry'] === null ? null : itemizedRow(book, found(book.transactions, idOf(field['entry']), 'entry'))
      const kind = kindOf(field['kind'])
      const draft =
        fromEntry === null
          ? { name: field['name'], account: found(book.accounts, idOf(field['account']), 'account').id, payee: field['payee'] ?? '', parts: kind === null ? [] : partsOf(kind, field['parts']) }
          : shortcutDraftOf(fromEntry.row, fromEntry.items)
      if (draft === null) throw new StepRefused('That entry waits on To review, so it has no category for a quick add yet.')
      const made = newShortcut(records, checked(book, { ...draft, name: field['name'] }))
      addShortcut(unit, made)
      return { shortcut: made }
    }
    case 'change-shortcut': {
      const held = heldShortcut(book, field['shortcut'], idOf)
      const kind = kindOf(field['kind']) ?? ((held.parts[0]?.amount ?? 0) < 0 ? 'out' : 'in')
      const given = field['parts'] as readonly { readonly amount: number; readonly category: string; readonly note: string }[]
      const parts =
        given.length === 0 ? held.parts.map((part) => ({ ...part, amount: kind === 'out' ? negateAccountMoney(absAccountMoney(part.amount)) : absAccountMoney(part.amount) })) : partsOf(kind, given)
      const draft = {
        name: field['name'] ?? held.shortcut.name,
        account: field['account'] === null ? held.shortcut.account : found(book.accounts, idOf(field['account']), 'account').id,
        payee: field['payee'] ?? held.shortcut.payee,
        parts,
      }
      changeShortcut(unit, held, checked(book, draft))
      return null
    }
    case 'move-shortcut':
      moveShortcut(unit, book.shortcuts, heldShortcut(book, field['shortcut'], idOf).shortcut, field['direction'] === 'up' ? -1 : 1)
      return null
    case 'delete-shortcut':
      deleteShortcut(unit, heldShortcut(book, field['shortcut'], idOf))
      return null
    default: {
      const held = heldShortcut(book, field['shortcut'], idOf)
      if (!shortcutsShown(book).some(({ shortcut }) => shortcut.id === held.shortcut.id)) throw new StepRefused('That quick add shows no button, since its account is closed or the bank fills it.')
      const [only] = held.parts
      if (field['amount'] !== null && (held.parts.length !== 1 || only === undefined)) throw new StepRefused('Only a quick add of one part takes another amount. change-entry fixes the entry after.')
      const amount = field['amount'] === null || only === undefined ? null : absAccountMoney(accountMoneyFromAmount(field['amount']))
      const parts = amount === null || only === undefined ? held.parts : [{ ...only, amount: only.amount < 0 ? negateAccountMoney(amount) : amount }]
      const day = field['date'] === null ? today() : dayOf(field['date'])
      const account = found(book.accounts, held.shortcut.account, 'account')
      if (day < account.openedOn) throw new StepRefused(`Its account starts on ${account.openedOn}.`)
      return { entry: addEntryFromShortcut(unit, records, { ...held, parts }, day) }
    }
  }
}
