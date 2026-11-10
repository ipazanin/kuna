import { fieldsOf } from './companyCard'
import type { CompanyCard, CompanyOperationSet } from './companyCard'
import { words } from './words'
import { dryRunFor, writeImport } from '../../imports/application/importStatements'
import { DATE_FORMATS, DECIMAL_MARKS, profileDraftProblem, profileKey, profileValue } from '../../imports/domain/importProfile'
import type { ImportProfile } from '../../imports/domain/importProfile'
import { StatementRefused, transcribedStatement } from '../../imports/domain/importedStatement'
import type { StatementReading } from '../../imports/domain/importedStatement'
import { removeSettings, setSettings } from '../../settings/application/settingWrites'
import { heldSettingValue } from '../../settings/domain/settings'
import { ACCOUNT_RECORDS, LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import { ATTACHMENT_REF } from '../../../../shared/app/assistantOperations'
import type { AssistantOperation, ProposalNote, ProposalStep } from '../../../../shared/app/assistantOperations'
import { COPY_THE_FILE, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, inputOf, isAttachment } from '../../../../shared/app/operationInput'
import { ROWS_A_PART, StepRefused } from '../../../../shared/app/proposedWrites'
import { ZERO, moneyFromAmount } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import { normaliseIban } from '../../../../shared/text/fold'
import { BOOKING_LOOK_ALIKE, copiedStatementCheck, copiedStatementRowsWarning, lookAlikesForTheModel, lookAlikesNote } from '../../../../shared/ai/presentation/copiedRowsWords'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { BOOKING_DAYS_APART, LOOK_ALIKES } from '../../../../shared/money/lookAlikeBookings'
import type { DryRunRow, ImportDryRun } from '../../imports/domain/importDryRun'
import type { Transaction } from '../../workbook/domain/workbook'

/** How the start of a statement goes, and the account a new IBAN takes. */
const START_FIELDS = {
  newAccount: { type: ['string', 'null'], description: "A short name for the account of a statement's IBAN the books lack, or null." },
  part: { type: 'integer', description: `Which ${ROWS_A_PART} rows of each statement this card imports, from 1.` },
} as const

/** The operations that import rows, whose card holds nothing else. */
export const IMPORTING: ReadonlySet<string> = new Set(['import-statement', 'file-held-statements'])

const IMPORT_STATEMENT: AssistantOperation = {
  name: 'import-statement',
  about: [
    "Imports a bank statement through Import's own dry run: rows already on the ledger are skipped, the rules file the new rows, and each account's rows must run on from its balance.",
    'file names the attached file by its id, whatever its format, a camt XML file or a bank sheet included, or null for a statement pasted as text.',
    'Read every row and copy each as written, oldest first, money out below zero. statementName names the statement in words as it names itself, such as its number or the month it covers, never as a key or as dates joined by a slash. Give the opening and closing balances only as the statement prints them, and never work one out. Without them the balances run on from the ledger and the card warns that Kuna could not check the rows.',
    `lookAlikes says what becomes of a copied row that looks like a ledger row from another source, such as a camt file or a bank sheet: the same amount on the same account at most ${BOOKING_DAYS_APART} days apart, unless the two counterparties and descriptions share no word. ask keeps it waiting, and the card lists it and asks the person to say in the chat. import imports it once the person says it is another payment: propose the same rows again with import once the card is answered, and a row dated before the account's newest row is still refused. A row of the same day, amount and counterparty as a ledger row is skipped either way.`,
    `A card carries at most ${ROWS_A_PART} copied rows. A longer statement goes in parts, oldest first, each its own card with only its own rows and the same statementName, part 1 first and each part once the one before is accepted. A part ends at the end of a day. Part 1 gives the opening alone and the last part both balances, and the parts between give neither. Kuna checks on the last part that its rows run on from where the earlier parts left the account to the closing. A statement in one part gives both or neither.`,
    "An account with no rows yet starts at the statement's opening, and the card says so.",
  ].join(' '),
  input: inputOf({
    file: TEXT_OR_NULL,
    account: TEXT_OR_NULL,
    opening: NUMBER_OR_NULL,
    closing: NUMBER_OR_NULL,
    rows: { type: 'array', items: inputOf({ date: TEXT, amount: NUMBER, counterparty: TEXT, iban: TEXT_OR_NULL, description: TEXT }) },
    statementName: TEXT_OR_NULL,
    lookAlikes: { type: 'string', enum: [...LOOK_ALIKES] },
    ...START_FIELDS,
    part: { type: 'integer', description: 'Which part of the statement this card imports, from 1.' },
  }),
  refs: { file: ATTACHMENT_REF, account: ACCOUNT_RECORDS.name },
  creates: null,
  alone: false,
  example: {
    file: null,
    account: 'account',
    opening: 760,
    closing: 720.5,
    rows: [
      { date: '2026-11-02', amount: -12.5, counterparty: 'Office supplies d.o.o.', iban: null, description: 'Paper' },
      { date: '2026-11-03', amount: -27, counterparty: 'Telecom d.d.', iban: null, description: 'Phone' },
    ],
    statementName: 'November 2026',
    lookAlikes: 'ask',
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

/** One part of a statement the AI copied, as the dry run reads it, with the words the card names it by. */
interface CopiedPart {
  readonly readings: readonly StatementReading[]
  readonly shownAs: string
}

/**
 * One part of a statement the AI copied off a page, a file or the chat, refused when its printed balances do not tie or break
 * the rule on which part gives them. Its parts are tied by the account's key and the statement's own name, so renaming the
 * account between parts keeps them one statement, and the card names it by the account's name.
 */
function copiedPart(card: CompanyCard, field: Readonly<Record<string, never>>): CopiedPart {
  const rows = field['rows'] as readonly { readonly date: string; readonly amount: number; readonly counterparty: string; readonly iban: string | null; readonly description: string }[]
  const name = field['statementName'] as string | null
  const part: number = field['part']
  if (field['account'] === null) throw new StepRefused('Copied rows name the account they are on.')
  if (name === null || name.trim() === '') throw new StepRefused('statementName names the statement, the same on every part of it.')
  if (!Number.isInteger(part) || part < 1) throw new StepRefused('part counts from 1.')
  if (rows.length === 0) throw new StepRefused('The statement has no rows to import.')
  if (rows.length > ROWS_A_PART) throw new StepRefused(`A card carries at most ${ROWS_A_PART} copied rows. Put the rest on the next part, which starts on the day after this one ends.`)
  const account = card.idOf(field['account']).toLowerCase()
  const named = card.workbook.accounts.find((candidate) => candidate.slug === account)
  if (named === undefined) throw new StepRefused('That account is no longer in the books.')
  const entries = rows.map((row) => ({
    date: dayOf(row.date),
    amount: moneyFromAmount(row.amount),
    counterparty: row.counterparty.trim(),
    counterpartyIban: row.iban === null ? '' : normaliseIban(row.iban),
    description: row.description.trim(),
  }))
  if (entries.some((entry) => entry.amount === 0)) throw new StepRefused('Every row has an amount other than zero.')
  // The label goes into each row's statement column and ties the parts together, so it is the account's key and the statement's own name, never words of one language.
  const label = `${account}, ${name.trim()}`
  const printed = (amount: number | null): Money | null => (amount === null ? null : moneyFromAmount(amount))
  try {
    const lookAlikes = choiceOf(LOOK_ALIKES, field['lookAlikes'], 'lookAlikes')!
    const statement = transcribedStatement(account, label, printed(field['opening']), printed(field['closing']), entries, lookAlikes, part, card.workbook.transactions)
    return { readings: [{ statement }], shownAs: `${named.label || named.slug}, ${name.trim()}` }
  } catch (failure) {
    if (failure instanceof StatementRefused) throw new StepRefused(failure.message)
    throw failure
  }
}

/** The readings of held statements, with each statement's rows up to the end of the part a card imports, so the parts before it are on the ledger. */
function upToPart(readings: readonly StatementReading[], part: number): readonly StatementReading[] {
  const longest = Math.max(1, ...readings.map((reading) => ('statement' in reading ? reading.statement.rows.length : 0)))
  const parts = Math.ceil(longest / ROWS_A_PART)
  if (!Number.isInteger(part) || part < 1 || part > parts) throw new StepRefused(`The statements have ${parts === 1 ? '1 part' : `${parts} parts`}, from part 1.`)
  return readings.map((reading) => ('statement' in reading ? { ...reading, statement: { ...reading.statement, rows: reading.statement.rows.slice(0, part * ROWS_A_PART) } } : reading))
}

/**
 * Writes the statements as Import does once a person confirms: each account with no rows started at its statement's opening, or
 * at zero for copied rows that print no balances, and a statement of a new IBAN under the account the step names. A statement the dry run refuses refuses the card, with its reason.
 * `copied` is the warning on rows the AI copied, null for held statements, and its label names the statement on every note. The card asks about look-alikes first, then warns, then states plain facts.
 */
function writeStatements(card: CompanyCard, readings: readonly StatementReading[], newAccount: string | null, copied: ProposalNote | null): void {
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
    if (statement.start.opening === null && copied !== null) {
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
  const lookAlikes = waitingLookAlikes(run)
  const lookAlikeRows = lookAlikes.map(({ number }) => number)
  if (run.newRows === 0 && lookAlikes.length > 0) throw new StepRefused(lookAlikesForTheModel(lookAlikeRows, true))
  if (run.newRows === 0) throw new StepRefused('Every row of the statement is on the ledger already.')
  writeImport(card.unit, run)
  const parts = (row: Pick<Transaction, 'counterparty' | 'description' | 'amount' | 'date'>): string[] =>
    [row.counterparty || row.description, formatMoney(row.amount), dayLabel(row.date)].filter((part) => part !== '')
  const started = [...starts.keys()]
  const shown = (label: string): string => copied?.label ?? label
  const notes: readonly ProposalNote[] = [
    ...(lookAlikes.length === 0
      ? []
      : [
          lookAlikesNote(
            lookAlikes.map(({ row, like }) => ({ row: parts(row), like: parts(like) })),
            BOOKING_LOOK_ALIKE,
          ),
        ]),
    ...(copied === null ? [] : [copied]),
    ...started.filter((account) => startedAtZero.has(account)).map((account): ProposalNote => ({ label: account, text: words.accountStartsAtZero(formatMoney(ZERO)), tone: 'warning' })),
    ...run.statements.flatMap((statement) => statement.notes.map((text): ProposalNote => ({ label: shown(statement.label), text, tone: 'warning' }))),
    ...started.filter((account) => !startedAtZero.has(account)).map((account): ProposalNote => ({ label: account, text: words.accountStarted(account), tone: 'neutral' })),
    ...run.accounts.map(({ slug }): ProposalNote => ({ label: slug, text: words.accountAdded(slug), tone: 'neutral' })),
    ...run.statements.flatMap((statement) => statement.facts.map((text): ProposalNote => ({ label: shown(statement.label), text, tone: 'neutral' }))),
  ]
  for (const note of notes) card.note({ noun: LEDGER_RECORDS.noun, note })
  if (lookAlikes.length > 0) card.holdBack(lookAlikesForTheModel(lookAlikeRows, false))
}

/** The copied rows that wait as look-alikes, each by its number among the rows the AI copied, beside the ledger row it looks like. */
function waitingLookAlikes(run: ImportDryRun): readonly { readonly number: number; readonly row: DryRunRow; readonly like: Transaction }[] {
  return run.statements.flatMap((statement) => statement.rows.flatMap((row, index) => (row.like === undefined ? [] : [{ number: index + 1, row, like: row.like }])))
}

function importStatement(card: CompanyCard, step: ProposalStep): void {
  const field = fieldsOf(step)
  const file: unknown = field['file']
  if (file !== null && !isAttachment(file)) throw new StepRefused('file is not a file attached to this chat.')
  if (file !== null && (field['rows'] as readonly unknown[]).length === 0) throw new StepRefused(COPY_THE_FILE)
  const { readings, shownAs } = copiedPart(card, field)
  const warning = copiedStatementRowsWarning(
    (field['rows'] as readonly unknown[]).length,
    file === null ? null : file.name,
    copiedStatementCheck({ part: field['part'] as number, opening: field['opening'] as number | null, closing: field['closing'] as number | null }),
  )
  writeStatements(card, readings, field['newAccount'], { label: shownAs, text: warning, tone: 'warning' })
}

/** The statements the last sync of the statements folder held back for a person, which `app.ts` hands in. */
export type HeldStatements = () => readonly StatementReading[]

function fileHeldStatements(card: CompanyCard, step: ProposalStep, held: HeldStatements): void {
  const readings = held()
  if (readings.length === 0) throw new StepRefused('The last sync held back no statement.')
  const field = fieldsOf(step)
  writeStatements(card, upToPart(readings, field['part']), field['newAccount'], null)
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
