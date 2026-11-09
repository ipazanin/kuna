import { fieldsOf } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { words } from './words'
import { dryRunFor, fittingProfiles, statementReadings, writeImport } from '../../imports/application/importStatements'
import type { LoadedImportFile } from '../../imports/application/importStatements'
import { DATE_FORMATS, DECIMAL_MARKS, profileDraftProblem, profileKey, profileValue } from '../../imports/domain/importProfile'
import type { ImportProfile } from '../../imports/domain/importProfile'
import { StatementRefused, transcribedStatement } from '../../imports/domain/importedStatement'
import type { StatementReading } from '../../imports/domain/importedStatement'
import { removeSettings, setSettings } from '../../settings/application/settingWrites'
import { heldSettingValue } from '../../settings/domain/settings'
import { ACCOUNT_RECORDS, LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { AssistantOperation, ProposalStep } from '../../../../shared/app/assistantOperations'
import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, inputOf, isAttachment } from '../../../../shared/app/operationInput'
import { ROWS_A_PART, StepRefused } from '../../../../shared/app/proposedWrites'
import { ZERO, moneyFromAmount } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import { normaliseIban } from '../../../../shared/text/fold'
import { copiedStatementRowsWarning } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { ChatAttachment } from '../../../../shared/ai/domain/chatAttachments'

/** What the import reads an attached file with, which `app.ts` hands in: Import's own reader of a camt document or a bank's sheet. */
export type StatementFileReader = (fileName: string, bytes: ArrayBuffer) => Promise<LoadedImportFile>

/** How the start of a statement goes, and the account a new IBAN takes. */
const START_FIELDS = {
  newAccount: { type: ['string', 'null'], description: "A short name for the account of a statement's IBAN the books lack, or null." },
  part: { type: 'integer', description: `Which ${ROWS_A_PART} rows of each statement this card imports, from 1.` },
} as const

const IMPORT_STATEMENT: AssistantOperation = {
  name: 'import-statement',
  about: [
    "Imports a bank statement through Import's own dry run: rows already on the ledger are skipped, the rules file the new rows, and each account's rows must run on from its balance.",
    'file names the attached file by its id, or null for a statement pasted as text. For a camt XML file or a bank sheet, account, opening and closing are null and rows empty, and Kuna reads it itself. A sheet reads by a saved import profile, by its name in profile or null for the one that fits. save-import-profile earlier on the same card saves one for a sheet no profile reads.',
    'For any other file or a pasted statement, profile is null. Read every row and copy each as written, oldest first, money out below zero. Give the opening and closing balances only when the statement prints both, and the rows must then lead from the one to the other. Never work out a balance. Without them the balances run on from the ledger and the card warns that Kuna could not check the rows.',
    `An account with no rows yet starts at the statement's opening, and the card says so. A statement over ${ROWS_A_PART} rows goes in parts, part 1 first, each its own card.`,
  ].join(' '),
  input: inputOf({
    file: TEXT_OR_NULL,
    profile: TEXT_OR_NULL,
    account: TEXT_OR_NULL,
    opening: NUMBER_OR_NULL,
    closing: NUMBER_OR_NULL,
    rows: { type: 'array', items: inputOf({ date: TEXT, amount: NUMBER, counterparty: TEXT, iban: TEXT_OR_NULL, description: TEXT }) },
    ...START_FIELDS,
  }),
  refs: { file: ATTACHMENT_REF, account: ACCOUNT_RECORDS.name },
  creates: null,
  alone: false,
  example: {
    file: null,
    profile: null,
    account: 'account',
    opening: 760,
    closing: 720.5,
    rows: [
      { date: '2026-11-02', amount: -12.5, counterparty: 'Office supplies d.o.o.', iban: null, description: 'Paper' },
      { date: '2026-11-03', amount: -27, counterparty: 'Telecom d.d.', iban: null, description: 'Phone' },
    ],
    newAccount: null,
    part: 1,
  },
}

const OPERATIONS: readonly AssistantOperation[] = [
  IMPORT_STATEMENT,
  {
    name: 'file-held-statements',
    about:
      "Files the statements the last sync of the statements folder held back, as Import's folder card does: an account with no rows starts at its statement's opening, and a statement of a new IBAN adds the account named in newAccount.",
    input: inputOf(START_FIELDS),
    refs: {},
    creates: null,
    alone: false,
    example: { newAccount: null, part: 1 },
  },
  {
    name: 'save-import-profile',
    about:
      "Saves how one bank's sheet reads, as Import's profile editor does: the columns by their header text, the account it is for, the date format and the decimal mark. amount is one signed column, or debit and credit two columns. Blank leaves a column out.",
    input: inputOf({
      name: TEXT,
      account: TEXT,
      date: TEXT,
      dateFormat: { type: 'string', enum: [...DATE_FORMATS] },
      decimal: { type: 'string', enum: [...DECIMAL_MARKS] },
      amount: TEXT,
      debit: TEXT,
      credit: TEXT,
      balance: TEXT,
      counterparty: TEXT,
      counterpartyIban: TEXT,
      description: TEXT,
      reference: TEXT,
    }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: {
      name: 'bank-sheet',
      account: 'account',
      date: 'Datum',
      dateFormat: 'dd.mm.yyyy',
      decimal: 'comma',
      amount: '',
      debit: 'Isplata',
      credit: 'Uplata',
      balance: 'Stanje',
      counterparty: 'Partner',
      counterpartyIban: '',
      description: 'Opis',
      reference: '',
    },
  },
  {
    name: 'delete-import-profile',
    about: 'Deletes a saved import profile by its name, so no sheet is read by it again.',
    input: inputOf({ name: TEXT }),
    refs: {},
    creates: null,
    alone: false,
    example: { name: 'saved-profile' },
  },
]

/** Why Company reads no statement from an attached file by itself, which sends the AI to read and copy it. */
const COPY_IT = 'Kuna does not read this file as a camt statement or a bank sheet. Read it with read_attachment and copy every row into rows as written, with file naming it.'

const KUNA_READS_IT = 'Kuna reads this file itself, so account, opening and closing are null and rows empty.'

function isLoaded(file: unknown): file is LoadedImportFile {
  return typeof file === 'object' && file !== null && 'fileName' in file && ('document' in file || 'grid' in file)
}

/**
 * What an import step's file stands for once read: Import's reader takes a camt file or a sheet whose rows the AI left empty, and a
 * file whose rows the AI copied stays as attached. Or why the file cannot be imported.
 */
async function loadedOf(file: unknown, copied: boolean, read: StatementFileReader): Promise<LoadedImportFile | ChatAttachment | string> {
  if (!isAttachment(file)) return 'file is not a file attached to this chat.'
  if (copied) return file.reading.kind === 'kuna' ? KUNA_READS_IT : file
  if (file.kind !== 'xml' && file.kind !== 'sheet' && file.kind !== 'csv') return COPY_IT
  try {
    return await read(file.name, file.bytes.slice().buffer)
  } catch {
    return COPY_IT
  }
}

/** The steps with each attached statement file read, since a dry run cannot wait for a file. Or why a file cannot be imported. */
export async function withStatementFilesRead(steps: readonly ProposalStep[], read: StatementFileReader): Promise<readonly ProposalStep[] | { readonly refused: readonly string[] }> {
  const done: ProposalStep[] = []
  for (const step of steps) {
    const file = step.input['file']
    if (step.operation !== IMPORT_STATEMENT.name || file === null || file === undefined) {
      done.push(step)
      continue
    }
    const rows = step.input['rows']
    const loaded = await loadedOf(file, Array.isArray(rows) && rows.length > 0, read)
    if (typeof loaded === 'string') return { refused: [loaded] }
    done.push({ ...step, input: { ...step.input, file: loaded } })
  }
  return done
}

/** The statements of a read file, by the profile the step names or the one saved profile that fits a sheet. */
function fileReadings(card: CompanyCard, loaded: LoadedImportFile, profileName: string | null): readonly StatementReading[] {
  const { workbook } = card
  let profile: ImportProfile | null = null
  if (loaded.kind === 'table') {
    const fitting = fittingProfiles(loaded.grid, workbook.settings.importProfiles)
    profile = profileName === null ? (fitting.length === 1 ? fitting[0]! : null) : (fitting.find((candidate) => candidate.name === profileName) ?? null)
    if (profile === null) {
      throw new StepRefused(
        fitting.length === 0
          ? 'No saved import profile reads this sheet. Read it with read_attachment, and put save-import-profile from its header row on this card before the import, or copy its rows into rows.'
          : `Name the profile that reads it: ${fitting.map((candidate) => candidate.name).join(', ')}.`,
      )
    }
  }
  return statementReadings(loaded, workbook, profile)
}

/** A statement the AI copied off a page, a file or the chat, refused when its printed balances do not tie or only one is given. */
function transcribedReadings(card: CompanyCard, field: Readonly<Record<string, never>>): readonly StatementReading[] {
  const rows = field['rows'] as readonly { readonly date: string; readonly amount: number; readonly counterparty: string; readonly iban: string | null; readonly description: string }[]
  if (field['account'] === null) throw new StepRefused('Copied rows name the account they are on.')
  if (rows.length === 0) throw new StepRefused('The statement has no rows to import.')
  const account = card.idOf(field['account']).toLowerCase()
  if (!card.workbook.accounts.some((candidate) => candidate.slug === account)) throw new StepRefused('That account is no longer in the books.')
  const entries = rows.map((row) => ({
    date: dayOf(row.date),
    amount: moneyFromAmount(row.amount),
    counterparty: row.counterparty.trim(),
    counterpartyIban: row.iban === null ? '' : normaliseIban(row.iban),
    description: row.description.trim(),
  }))
  if (entries.some((entry) => entry.amount === 0)) throw new StepRefused('Every row has an amount other than zero.')
  const days = entries.map((entry) => entry.date).sort()
  // The label goes into each row's statement column, so it is built from the account and the days, never from words of one language.
  const label = `${account} ${days[0]!}/${days.at(-1)!}`
  const printed = (amount: number | null): Money | null => (amount === null ? null : moneyFromAmount(amount))
  try {
    return [{ statement: transcribedStatement(account, label, printed(field['opening']), printed(field['closing']), entries) }]
  } catch (failure) {
    if (failure instanceof StatementRefused) throw new StepRefused(failure.message)
    throw failure
  }
}

/** The readings with each statement's rows up to the end of the part a card imports, so the parts before it are on the ledger. */
function upToPart(readings: readonly StatementReading[], part: number): readonly StatementReading[] {
  const longest = Math.max(1, ...readings.map((reading) => ('statement' in reading ? reading.statement.rows.length : 0)))
  const parts = Math.ceil(longest / ROWS_A_PART)
  if (!Number.isInteger(part) || part < 1 || part > parts) throw new StepRefused(`The statements have ${parts === 1 ? '1 part' : `${parts} parts`}, from part 1.`)
  return readings.map((reading) => ('statement' in reading ? { ...reading, statement: { ...reading.statement, rows: reading.statement.rows.slice(0, part * ROWS_A_PART) } } : reading))
}

/**
 * Writes the statements as Import does once a person confirms: each account with no rows started at its statement's opening, or
 * at zero for copied rows that print no balances, and a statement of a new IBAN under the account the step names. A statement the dry run refuses refuses the card, with its reason.
 */
function writeStatements(card: CompanyCard, readings: readonly StatementReading[], newAccount: string | null, copied: boolean): void {
  const { workbook } = card
  const offers = [...new Set(readings.flatMap((reading) => ('newAccount' in reading ? [reading.newAccount.iban] : [])))]
  if (offers.length > 1) throw new StepRefused('The file names several IBANs the books lack. Import it on Import, which names each account.')
  if (offers.length === 1 && newAccount === null) throw new StepRefused("The statement's IBAN names no account in the books. Give newAccount a short name for it.")
  const names = new Map(offers.map((iban) => [iban, newAccount!.trim().toLowerCase()]))
  const waiting = dryRunFor(readings, workbook, new Map(), names)
  const starts = new Map<string, Money>()
  const startedAtZero = new Set<string>()
  for (const statement of waiting.statements) {
    if (statement.start === null || statement.newAccount !== null) continue
    if (statement.start.opening === null && copied) {
      starts.set(statement.start.account, ZERO)
      startedAtZero.add(statement.start.account)
      continue
    }
    if (statement.start.opening === null)
      throw new StepRefused(
        `${statement.label} gives no balances, and ${statement.start.account} has no rows on the ledger yet to run on from. Give the opening and closing balances the statement prints, or type the opening on Import.`,
      )
    starts.set(statement.start.account, statement.start.opening)
  }
  const run = starts.size === 0 ? waiting : dryRunFor(readings, workbook, starts, names)
  const refused = run.statements.filter((statement) => statement.refusal !== null)
  if (refused.length > 0) throw new StepRefused(refused.map((statement) => `${statement.label}: ${statement.refusal}`).join(' '))
  if (run.statements.some((statement) => statement.newAccount !== null && statement.account === '')) throw new StepRefused(`${newAccount} cannot be an account's short name.`)
  if (run.newRows === 0) throw new StepRefused('Every row of the statement is on the ledger already.')
  writeImport(card.unit, run)
  for (const account of starts.keys()) {
    const warning = startedAtZero.has(account) ? words.accountStartsAtZero(formatMoney(ZERO)) : words.accountStarted(account)
    card.note({ noun: LEDGER_RECORDS.noun, line: { label: account, fields: [], warning } })
  }
  for (const { slug } of run.accounts) card.note({ noun: LEDGER_RECORDS.noun, line: { label: slug, fields: [], warning: words.accountAdded(slug) } })
  for (const statement of run.statements) {
    for (const note of statement.notes) card.note({ noun: LEDGER_RECORDS.noun, line: { label: statement.label, fields: [], warning: note } })
  }
}

function importStatement(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const file: unknown = field['file']
  const part: number = field['part']
  if (isLoaded(file)) {
    if (field['account'] !== null || field['opening'] !== null || field['closing'] !== null) throw new StepRefused(KUNA_READS_IT)
    writeStatements(card, upToPart(fileReadings(card, file, field['profile']), part), field['newAccount'], false)
    return
  }
  if (file !== null && !isAttachment(file)) throw new StepRefused('file is not a file attached to this chat.')
  const readings = upToPart(transcribedReadings(card, field), part)
  const rows = (field['rows'] as readonly unknown[]).length
  const onCard = Math.min(part * ROWS_A_PART, rows) - (part - 1) * ROWS_A_PART
  const label = 'statement' in readings[0]! ? readings[0].statement.label : ''
  writeStatements(card, readings, field['newAccount'], true)
  // A note goes above the ones before it, so the copied rows' warning, written last, reads first.
  card.note({ noun: LEDGER_RECORDS.noun, line: { label, fields: [], warning: copiedStatementRowsWarning(onCard, file === null ? null : file.name, field['opening'] !== null) } })
}

/** The statements the last sync of the statements folder held back for a person, which `app.ts` hands in. */
export type HeldStatements = () => readonly StatementReading[]

function fileHeldStatements(card: CompanyCard, step: ProposalStep, held: HeldStatements): void {
  const readings = held()
  if (readings.length === 0) throw new StepRefused('The last sync held back no statement.')
  const field = fieldsOf(step)
  writeStatements(card, upToPart(readings, field['part']), field['newAccount'], false)
}

function saveImportProfile(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const text = (name: string): string => String(field[name]).trim()
  const signed = text('amount')
  const profile: ImportProfile = {
    name: text('name').toLowerCase(),
    account: card.idOf(field['account']).toLowerCase(),
    date: text('date'),
    dateFormat: field['dateFormat'],
    decimal: field['decimal'],
    amount: signed !== '' ? { signed } : { debit: text('debit'), credit: text('credit') },
    balance: text('balance'),
    counterparty: text('counterparty'),
    counterpartyIban: text('counterpartyIban'),
    description: text('description'),
    reference: text('reference'),
  }
  const problem = profileDraftProblem(profile)
  if (problem !== null) throw new StepRefused(problem)
  const settings = card.records().settings
  if (heldSettingValue(settings, profileKey(profile.name)) !== null) throw new StepRefused(`A profile is saved as ${profile.name} already. Delete it first, or pick another name.`)
  setSettings(card.unit, settings, [{ key: profileKey(profile.name), value: profileValue(profile) }])
}

function deleteImportProfile(card: CompanyCard, step: ProposalStep): void {
  const key = profileKey(String(fieldsOf(step)['name']).trim().toLowerCase())
  const settings = card.records().settings
  if (heldSettingValue(settings, key) === null) throw new StepRefused('No import profile is saved by that name.')
  removeSettings(card.unit, settings, [key])
}

/** What the chat can import into the ledger and how Import reads a bank's sheet, through Import's own dry run and writes. */
export function importOperations(held: HeldStatements): CompanyOperationSet {
  const plans: Readonly<Record<string, (card: CompanyCard, step: ProposalStep) => void>> = {
    'import-statement': importStatement,
    'file-held-statements': (card, step) => fileHeldStatements(card, step, held),
    'save-import-profile': saveImportProfile,
    'delete-import-profile': deleteImportProfile,
  }
  return { operations: OPERATIONS, planStep: (card, step) => plans[step.operation]!(card, step) }
}
