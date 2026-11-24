import { computed, shallowReactive, shallowReadonly, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { readingKeeper, runsOfPlan } from '../application/keptReading'
import { readMailReports } from '../application/mailReports'
import type { MailReportPlan, MailReportPorts } from '../application/mailReports'
import { importMailedReport, syncImports } from '../application/reportImport'
import { IBKR_FLEX_FINGERPRINT, IBKR_FLEX_RECIPE, ibkrMailReader } from '../domain/ibkrFlexRecipe'
import { openMailReadingCache } from '../infrastructure/mailReadingCache'
import { newestReportDay, reportNews } from '../domain/mailReview'
import type { ReportNews } from '../domain/mailReview'
import { reportRows } from '../domain/reportRows'
import { MAIL_LIST_LINK, mailStepResult } from './mailStepResult'
import { words } from './words'
import { accountSources } from '../../imports/domain/accountIntake'
import { earliestFrom } from '../../../../shared/app/accountSource'
import type { WorkbookRows } from '../../imports/domain/importDryRun'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { usePrices } from '../../prices/presentation/usePrices'
import { INVESTMENTS_GENERAL_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { MailReader } from '../../workbook/domain/mailReader'
import { deviceTimeZone, parseCivilDate, startOfDayIn } from '../../../../shared/calendar/civilDate'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import { currentToken } from '../../../../shared/google/googleAuth'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import type { Mailbox } from '../../../../shared/mail/application/mailReading'
import { gmailMailbox } from '../../../../shared/mail/infrastructure/gmailMailbox'
import { NO_RATES } from '../../../../shared/money/rateBook'
import type { RecipeRun } from '../../../../shared/recipes/domain/runRecipe'
import { fileNameFits, readRecipeFile } from '../../../../shared/recipes/infrastructure/recipeFile'
import type { RecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import type { StepResult } from '../../../../shared/sync/application/syncRun'
import { writeReader } from '../application/mailReaderWrites'
import { plural } from '../../../../shared/text/translation'

export const MAIL_SCOPE: GoogleScope = 'gmail.readonly'

/** Where a step that found no account to read for links: the accounts on Settings, General, each with how its rows come in. */
const ACCOUNTS_LINK = { label: words.step.seeAccounts, to: `${INVESTMENTS_GENERAL_ROUTE}#accounts` } as const

/** The step's last good reading of the books' file, kept in this browser, and why the last run stopped, or null. */
const state = shallowReactive<MailReportsState>({ fileId: null, plan: null, readAt: null, stopped: null })

/** What this page already made of each file. A sync on a timer would otherwise fetch every file of the window again. */
const known = new Map<string, RecipeRun>()

const keeper = readingKeeper(openMailReadingCache, IBKR_FLEX_FINGERPRINT)

/** The imports the syncs of this page made, so a reading Undo took back is not imported again. */
const imports = syncImports()

/** The Drive file the books are on, or null for books kept in this browser or none, which have no reading. */
function driveFileId(): string | null {
  const choice = useInvestmentsBooks().state.choice
  return choice?.source === 'drive' ? choice.id : null
}

function forgetReading(fileId: string | null): void {
  state.fileId = fileId
  state.plan = null
  state.readAt = null
  state.stopped = null
  known.clear()
}

/** Shows the reading this browser kept of the file the books are on, unless a sync of this page read it first. */
async function openKept(fileId: string | null): Promise<void> {
  if (state.fileId !== fileId) forgetReading(fileId)
  const kept = await keeper.open(fileId).catch(() => null)
  if (kept === null || driveFileId() !== fileId || state.fileId !== fileId || state.plan !== null) return
  state.plan = kept.plan
  state.readAt = kept.readAt
  for (const [key, run] of runsOfPlan(kept.plan)) known.set(key, run)
}

async function dropReading(): Promise<void> {
  forgetReading(state.fileId)
  await keeper.drop().catch(() => null)
}

let watching = false

/** Follows the books to their file and the reader's switch, once for the page: a reading belongs to one file, and stopping the mail drops it. */
function followBooks(): void {
  if (watching) return
  watching = true
  const books = useInvestmentsBooks()
  watch(driveFileId, (fileId) => void openKept(fileId), { immediate: true })
  watch(
    () => ibkrMailReader(books.state.workbook?.book)?.on,
    (on) => {
      if (on === false) void dropReading()
    },
  )
}

async function openMailbox(): Promise<Mailbox> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeReportMailbox } = await import('../infrastructure/fake/fakeReportMail')
    return fakeReportMailbox(new URLSearchParams(window.location.search).get('fake'))
  }
  const token = currentToken(MAIL_SCOPE)
  if (token === null) throw new Error(words.step.accessRanOut)
  return gmailMailbox(token)
}

/** A report's mail read into rows, oldest file first, for the dry run, which takes each account's rows from its start day. */
function rowsOfPlan(plan: MailReportPlan, reader: MailReader, book: InvestmentBook): WorkbookRows {
  return reportRows(
    IBKR_FLEX_RECIPE,
    plan.mails.flatMap((mail) => (mail.kind === 'read' ? [mail.file] : [])),
    reader,
    { kind: 'mailed', since: earliestFrom(accountSources(book).values(), 'mail') },
  )
}

interface MailReportsState {
  /** The Drive file the reading is of. */
  fileId: string | null
  plan: MailReportPlan | null
  /** ISO timestamp of the sync that read the plan, on this page or an earlier one. */
  readAt: string | null
  stopped: string | null
}

export interface MailReports {
  readonly state: Readonly<MailReportsState>
  readonly reader: ComputedRef<MailReader | null>
  /** Null before a sync read the mail of the books' file, and while the reader is off. */
  readonly reading: ComputedRef<WorkbookRows | null>
  readonly news: ComputedRef<ReportNews | null>
  /** A real mail fitted the recipe, on this page or when an earlier record was made from one. */
  readonly confirmed: ComputedRef<boolean>
}

/** The mail step's last good reading, shared by the whole page and kept in this browser, and what it holds for the person now. */
export function useMailReports(): MailReports {
  followBooks()
  const store = useInvestmentsBooks()
  const { sources } = usePortfolio()
  const book = computed(() => store.state.workbook?.book ?? null)
  const reader = computed(() => ibkrMailReader(book.value))
  const reading = computed(() => (state.plan === null || reader.value?.on !== true || book.value === null || state.fileId !== driveFileId() ? null : rowsOfPlan(state.plan, reader.value, book.value)))
  return {
    state: shallowReadonly(state),
    reader,
    reading,
    news: computed(() => (reading.value === null || book.value === null ? null : reportNews(reading.value, book.value, sources.value?.rates ?? NO_RATES))),
    confirmed: computed(() => (book.value !== null && newestReportDay(book.value) !== null) || (state.plan?.mails.some((mail) => mail.kind === 'read') ?? false)),
  }
}

/** Writes IBKR's reader as `after`, with Undo, as the card's fields and switch and Kuna settings' stop do. Resolves to whether it went through. */
export function writeMailReader(writes: RecordWrites, after: MailReader, options: { readonly key: string; readonly title: string; readonly shownAtOnce: boolean }): Promise<boolean> {
  const store = useInvestmentsBooks()
  const before = ibkrMailReader(store.state.workbook?.book)
  return writes.write(
    options.title,
    (unit) => {
      const book = store.state.workbook?.book
      if (book !== undefined) writeReader(unit, book, before, after)
    },
    { key: options.key, failedTitle: words.card.notSaved, shownAtOnce: options.shownAtOnce },
  )
}

/**
 * The mail step of Investments' sync, listed while the reader is off too so Kuna settings shows it, and left out of the step list then.
 * It reads what is new and imports it by itself when the review would ask nothing, with Undo on the step's row. A file that does not
 * fit fails the step with why. `writes` makes the stop that turns the reader off.
 */
export function mailReportStep(writes: RecordWrites): SyncStep {
  followBooks()
  const books = useInvestmentsBooks()
  return {
    id: 'ibkr-mail',
    label: words.step.label,
    scopes: () => (ibkrMailReader(books.state.workbook?.book)?.on === true ? [MAIL_SCOPE] : []),
    startLine: words.step.searching,
    on: () => ibkrMailReader(books.state.workbook?.book)?.on === true,
    leftOutWhenOff: true,
    readsMail: {
      link: MAIL_LIST_LINK,
      async stop() {
        const reader = ibkrMailReader(books.state.workbook?.book)
        if (reader?.on !== true) return
        await writeMailReader(writes, { ...reader, on: false }, { key: 'mail-stop', title: words.step.stoppedTitle, shownAtOnce: false })
      },
    },
    run: readReports,
  }
}

/** Reads what is new in IBKR's mail for the books on screen, imports it when nothing needs the person, and says it as the step's line. */
async function readReports(): Promise<StepResult> {
  const books = useInvestmentsBooks()
  const { workbook, choice } = books.state
  const reader = ibkrMailReader(workbook?.book)
  if (workbook === null || reader === null || choice?.source !== 'drive') {
    return { kind: 'done', line: words.step.beforeBooks, writeId: null, link: null }
  }
  await openKept(choice.id)
  const since = earliestFrom(accountSources(workbook.book).values(), 'mail')
  if (since === null) {
    await dropReading()
    return { kind: 'done', line: words.step.noAccount, writeId: null, link: ACCOUNTS_LINK }
  }
  const newest = newestReportDay(workbook.book)
  const newestDay = newest === null ? null : parseCivilDate(newest)
  const ports: Omit<MailReportPorts, 'mailbox'> = {
    recipe: IBKR_FLEX_RECIPE,
    reader,
    sinceStart: startOfDayIn(since, deviceTimeZone()),
    newest: newestDay === null ? null : startOfDayIn(newestDay, deviceTimeZone()),
    fits: (name) => fileNameFits(IBKR_FLEX_RECIPE, name),
    readFile: (bytes) => readRecipeFile(IBKR_FLEX_RECIPE, bytes),
    known,
  }
  let plan: MailReportPlan
  try {
    plan = await readMailReports({ ...ports, mailbox: await openMailbox() })
  } catch (failure) {
    // The last good reading stays on screen and in this browser, so what waits does not vanish with the access.
    state.stopped = isUnauthorized(failure) ? words.step.stopped : failure instanceof Error ? failure.message : String(failure)
    throw failure
  }
  const readAt = new Date().toISOString()
  Object.assign(state, { fileId: choice.id, plan, readAt, stopped: null })
  await keeper.keep(choice.id, plan, readAt).catch(() => null)
  const misfit = plan.mails.some((mail) => mail.kind === 'misfit')
  const outcome = await importMailedReport({
    store: books,
    reading: rowsOfPlan(plan, reader, workbook.book),
    reader,
    misfit,
    undone: imports.undone(books.state.writes),
    rates: () => usePortfolio().sources.value?.rates ?? NO_RATES,
    fetchRates: (wanted) => usePrices().fetchRates(wanted),
    title: (records) => plural(words.step.importedTitle(records), records),
  })
  imports.add(outcome)
  const book = books.state.workbook?.book ?? workbook.book
  const news = reportNews(rowsOfPlan(plan, reader, book), book, usePortfolio().sources.value?.rates ?? NO_RATES)
  const writeId = outcome.kind === 'imported' ? (books.state.writes.find((written) => written.receipt === outcome.receipt)?.id ?? null) : null
  return mailStepResult(plan, outcome, news, writeId)
}
