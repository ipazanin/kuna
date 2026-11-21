import { TEXT, TEXT_OR_NULL, found, inputOf, isAttachment } from '../../../../shared/app/operationInput'
import { tableRecipeInput } from '../../../../shared/app/recipeInput'
import { draftOfInput } from '../../../../shared/recipes/domain/draftInput'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { ChatAttachment } from '../../../../shared/ai/domain/chatAttachments'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { runRecipe } from '../../../../shared/recipes/domain/runRecipe'
import { tableRows } from '../../../../shared/recipes/domain/tableRows'
import { unclaimedValues } from '../../../../shared/recipes/domain/unclaimedValues'
import { tableFileCells } from '../../../../shared/recipes/infrastructure/recipeFile'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { deleteRecipe, newRecipeId, saveRecipe } from '../../statements/application/recipeWrites'
import { fittingRecipe, recipeStatement, statementRecipesOf } from '../../statements/domain/recipeStatement'
import type { StatementRecipe } from '../../statements/domain/recipeStatement'
import { STATEMENT_RECIPE_FIELDS, statementRecipeOf } from '../../statements/domain/statementRecipeDraft'
import type { StatementRecipeProblem } from '../../statements/domain/statementRecipeDraft'
import type { StatementRefusal, StatementRows } from '../../statements/domain/statementRows'
import { words as statementWords } from '../../statements/domain/words'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { SavedRecipe } from '../../workbook/domain/savedRecipe'
import { RECIPE_RECORDS } from '../../workbook/domain/spendingKinds'

const RECIPE_INPUT = tableRecipeInput(STATEMENT_RECIPE_FIELDS)

const RECIPE_ABOUT = [
  "bank names the bank whose accounts take the rows, as Accounts names it, and currency every row's currency when the file names none, or null when columns.currency names it.",
  'Columns are named as the header row writes them. dateFormat is how dateColumn writes a day, and a format with HH reads the time from it too. A sheet writes a day cell as yyyy-MM-dd or yyyy-MM-dd HH:mm:ss.',
  'amountColumn holds one amount, money out below zero, or is null when debitColumn and creditColumn hold money out and money in. decimalMark is how a csv writes its decimals. A sheet writes a number cell with a point.',
  'columns.description is the payee or the bank text, columns.fee a fee charged on the row, and columns.currency the currency of each row, each null when the file has none.',
  'kinds are tried in order, the first a row passes taking it. A kind with column null takes every row, equals takes a row whose column holds one of the values in any case, and equals null takes a row whose column is filled. payment is a booked row, pending one the bank has not booked, not-completed a declined or reverted row that is only counted, and exchange and cash-withdrawal a booked exchange or cash taken out.',
].join(' ')

/** What Import's recipes do through the chat: write one from a file, change one, and delete one. */
export const RECIPE_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'save-recipe',
    about: [
      'Writes a recipe for a bank\'s statement file, csv or a sheet, that no recipe of Import reads yet, so Import reads the next one with no AI. Read only its sample, read_attachment with rows "sample", then give the file by its id.',
      'Kuna reads every row of the file with the recipe and the card shows the recipe beside the rows it imports, as one write with one Undo. A file a recipe reads already is refused with its name: copy it with import-statement only when the person asks.',
      'When Kuna cannot read a row it says which values no kind took or which cell it could not read. Fix the recipe and propose it again.',
      RECIPE_ABOUT,
    ].join(' '),
    input: inputOf({ file: TEXT, bank: TEXT, currency: TEXT_OR_NULL, ...RECIPE_INPUT }),
    refs: { file: ATTACHMENT_REF },
    creates: RECIPE_RECORDS.name,
    alone: false,
    example: {
      file: 'a1',
      bank: 'OTP banka',
      currency: 'EUR',
      name: 'OTP banka current account',
      dateColumn: 'Datum',
      dateFormat: 'dd.MM.yyyy',
      amountColumn: 'Iznos',
      debitColumn: null,
      creditColumn: null,
      decimalMark: 'comma',
      columns: { description: 'Opis', fee: null, currency: null },
      kinds: [{ kind: 'payment', column: null, equals: null }],
    },
  },
  {
    name: 'change-recipe',
    about: [
      "Changes a recipe Import reads a bank's files with, such as one that no longer fits a file after the bank renamed a column. Give every field as it should be, from the recipe as find_records reads it.",
      'With file, Kuna reads that file with the changed recipe and the card imports its rows too. With file null it changes the recipe alone.',
      RECIPE_ABOUT,
    ].join(' '),
    input: inputOf({ recipe: TEXT, file: TEXT_OR_NULL, bank: TEXT, currency: TEXT_OR_NULL, ...RECIPE_INPUT }),
    refs: { recipe: RECIPE_RECORDS.name, file: ATTACHMENT_REF },
    creates: null,
    alone: false,
    example: {
      recipe: 'recipe',
      file: null,
      bank: 'OTP banka',
      currency: 'EUR',
      name: 'OTP banka current account',
      dateColumn: 'Datum valute',
      dateFormat: 'dd.MM.yyyy',
      amountColumn: null,
      debitColumn: 'Isplata',
      creditColumn: 'Uplata',
      decimalMark: 'comma',
      columns: { description: 'Opis', fee: null, currency: null },
      kinds: [{ kind: 'payment', column: null, equals: null }],
    },
  },
  {
    name: 'delete-recipe',
    about: 'Deletes a recipe Import reads files with. An account keeps the bank the recipe named.',
    input: inputOf({ recipe: TEXT }),
    refs: { recipe: RECIPE_RECORDS.name },
    creates: null,
    alone: false,
    example: { recipe: 'recipe' },
  },
]

const RECIPE_STEPS: ReadonlySet<string> = new Set(RECIPE_OPERATIONS.map((operation) => operation.name))

/** The steps that read a file with a recipe, which an import card holds alone. */
export const READING_RECIPES: ReadonlySet<string> = new Set(['save-recipe', 'change-recipe'])

export function isRecipeStep(operation: string): boolean {
  return RECIPE_STEPS.has(operation)
}

/** An attached file a recipe step reads, with its first sheet's cells as Import reads them. */
interface ReadFile {
  readonly name: string
  readonly cells: readonly (readonly string[])[]
}

function isReadFile(value: unknown): value is ReadFile {
  return typeof value === 'object' && value !== null && 'cells' in value && 'name' in value
}

/** Reads the first sheet of each file a recipe step names before the dry run, as Import reads a dropped file. A file that is no csv or sheet is refused. */
export async function withRecipeFilesRead(steps: readonly ProposalStep[]): Promise<readonly ProposalStep[] | { readonly refused: readonly string[] }> {
  const read: ProposalStep[] = []
  for (const step of steps) {
    const file: unknown = step.input['file']
    if (!READING_RECIPES.has(step.operation) || file === null || file === undefined) {
      read.push(step)
      continue
    }
    if (!isAttachment(file)) return { refused: ['file is not a file attached to this chat.'] }
    const refused = unreadFile(file)
    if (refused !== null) return { refused: [refused] }
    try {
      read.push({ ...step, input: { ...step.input, file: { name: file.name, cells: await tableFileCells(file.name, file.bytes.slice().buffer) } satisfies ReadFile } })
    } catch {
      return { refused: ['Kuna could not read that file as a table. Say so.'] }
    }
  }
  return read
}

function unreadFile(file: ChatAttachment): string | null {
  return file.kind === 'csv' || file.kind === 'sheet' ? null : "Import reads a csv or a sheet. Copy any other file's rows with import-statement."
}

/** Why a recipe the step drafts cannot be kept, in words the model fixes it by. */
function problemText(problem: StatementRecipeProblem): string {
  switch (problem.kind) {
    case 'no-name':
      return 'name names the recipe.'
    case 'no-date':
      return 'dateColumn names the column of the day.'
    case 'no-format':
      return 'dateFormat says how the day is written.'
    case 'no-amount':
      return 'amountColumn names the amount, or debitColumn and creditColumn both name theirs.'
    case 'no-kind':
      return 'kinds holds at least one kind.'
    case 'nothing-comes-in':
      return 'At least one kind brings rows in, such as payment.'
    case 'unknown-kind':
      return `${problem.name} is no kind Spending reads.`
    case 'test-no-column':
      return `The ${problem.name} kind tests no column.`
    case 'test-no-value':
      return `The ${problem.name} kind's equals holds no value.`
    case 'doubled-column':
      return `Two fields read the column ${problem.column}. Each reads a column of its own.`
    case 'no-bank':
      return 'bank names the bank whose accounts take the rows.'
    case 'no-currency':
      return 'Give currency, or columns.currency where each row names its own.'
    case 'unreadable':
      return 'Kuna could not keep the recipe as drafted. Check its columns and kinds.'
  }
}

/** Why Kuna could not read the file with the recipe, naming only the values no kind took or the one cell it could not read. */
function readRefusal(refusal: StatementRefusal, { recipe, bank }: StatementRecipe, cells: readonly (readonly string[])[]): string {
  switch (refusal.kind) {
    case 'no-column':
      return `None of the first 40 rows holds every column the recipe reads. ${refusal.column} is missing.`
    case 'no-kind': {
      const table = tableRows(recipe, cells)
      const run = table.kind === 'read' ? runRecipe(recipe, table.rows) : null
      const [section] = recipe.sections
      const rows = table.kind === 'read' && section !== undefined ? (table.rows.get(section.name) ?? []) : []
      const unclaimed = run === null || run.kind === 'misfit' || section === undefined ? [] : unclaimedValues(section, rows, run.asked)
      const values = unclaimed.map(({ column, values }) => `${column}: ${values.map(({ value, rows }) => `${value === '' ? '(blank)' : JSON.stringify(value)} on ${rows}`).join(', ')}`)
      return `No kind takes some rows, from line ${refusal.line}. The values no kind took, with how many rows hold each: ${values.length === 0 ? 'every row, as no kind tests a column' : values.join('. ')}.`
    }
    case 'unreadable':
      return `Line ${refusal.line}: the column ${refusal.column} reads ${JSON.stringify(refusal.text.slice(0, 40))}, which is no ${refusal.reads === 'day' ? 'day in dateFormat' : refusal.reads === 'amount' ? 'amount with that decimalMark' : 'text it can be'}.`
    case 'not-a-currency':
      return `Line ${refusal.line}: ${JSON.stringify(refusal.text.slice(0, 12))} is no currency code.`
    case 'many-accounts':
      return `Two open accounts of ${refusal.bank} keep ${refusal.currency}: ${refusal.names.join(', ')}. Ask the person which account of the bank the file is for, and give the other another bank.`
    case 'missing-accounts':
      return `No account of ${bank} keeps the file's rows in their currency. Propose add-account for it with bank ${bank} on a card before this one, once the person says from which day it opens.`
    case 'no-recipe':
      return 'Kuna could not read the file with the recipe.'
  }
}

/** The recipe a step writes, under the id it has or gets. */
function draftedRecipe(input: Readonly<Record<string, never>>, id: SavedRecipe['id']): SavedRecipe {
  const currencyText: unknown = input['currency']
  const currency: CurrencyCode | null = typeof currencyText === 'string' ? currencyCodeOf(currencyText.toUpperCase()) : null
  if (typeof currencyText === 'string' && currency === null) throw new StepRefused(`${currencyText} is no currency code.`)
  const made = statementRecipeOf(id, draftOfInput(input), input['bank'], currency)
  if ('problems' in made) throw new StepRefused(made.problems.map(problemText).join(' '))
  return made.saved
}

/** The rows a recipe reads from a file, or why it cannot, for the model to fix the recipe by. */
function readWith(saved: SavedRecipe, file: ReadFile, book: SpendingBook): StatementRows {
  if (saved.recipe.file.format !== 'table') throw new StepRefused('Import reads table recipes.')
  const source: StatementRecipe = { recipe: { ...saved.recipe, file: saved.recipe.file }, bank: saved.bank, currency: saved.currency }
  const reading = recipeStatement(source, file.cells, file.name, book, statementWords.feeOn)
  if ('refused' in reading) throw new StepRefused(readRefusal(reading.refused, source, file.cells))
  return reading.statement
}

/** The recipe Import already reads a file with, other than the one a step changes, or null. */
function readingAlready(book: SpendingBook, file: ReadFile, except: SavedRecipe['id'] | null): string | null {
  const saved = book.recipes.find((recipe) => recipe.id === except)?.recipe.id
  return (
    fittingRecipe(
      statementRecipesOf(book).filter((source) => source.recipe.id !== saved),
      file.cells,
    )?.recipe.name ?? null
  )
}

/**
 * Writes a recipe step: keeps the recipe, or deletes it, and gives the statement a step's file reads with the recipe, which the
 * card imports in the same write. A file a recipe of Import reads already is refused, since Import reads it with no AI.
 */
export function writeRecipeStep(unit: UnitOfWork, book: SpendingBook, operation: string, input: Readonly<Record<string, never>>, idOf: (value: unknown) => string): StatementRows | null {
  const before = operation === 'save-recipe' ? null : found(book.recipes, idOf(input['recipe']), 'recipe')
  if (operation === 'delete-recipe') {
    deleteRecipe(unit, before!)
    return null
  }
  const saved = draftedRecipe(input, before?.id ?? newRecipeId())
  const file: unknown = input['file']
  if (file !== null && !isReadFile(file)) throw new StepRefused('file is not a file attached to this chat.')
  if (file === null && before === null) throw new StepRefused('save-recipe reads the file it is written from. Give the file by its id.')
  const statement = file === null ? null : readWithNew(saved, file, book, before)
  saveRecipe(unit, before, saved)
  return statement
}

function readWithNew(saved: SavedRecipe, file: ReadFile, book: SpendingBook, before: SavedRecipe | null): StatementRows {
  const already = readingAlready(book, file, before?.id ?? null)
  if (already !== null) throw new StepRefused(`The recipe ${already} reads this file already, so Import reads it with no AI. Tell the person, and copy it with import-statement only when they ask.`)
  return readWith(saved, file, book)
}
