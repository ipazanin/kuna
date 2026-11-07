import { computed, shallowReactive, shallowReadonly } from 'vue'
import type { ComputedRef } from 'vue'

import { readMailReports } from '../application/mailReports'
import type { MailReportPlan, MailReportPorts } from '../application/mailReports'
import { IBKR_FLEX_RECIPE } from '../domain/ibkrFlexRecipe'
import { newestReportDay, reportNews } from '../domain/mailReview'
import type { ReportNews } from '../domain/mailReview'
import { reportRows } from '../domain/reportRows'
import { words as mailWords } from '../domain/words'
import { words } from './words'
import type { WorkbookRows } from '../../imports/domain/importDryRun'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { INVESTMENTS_GENERAL_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { MailReader } from '../../workbook/domain/mailReader'
import { deviceTimeZone, parseCivilDate, startOfDayIn } from '../../../../shared/calendar/civilDate'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import { currentToken } from '../../../../shared/google/googleAuth'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import type { Mailbox } from '../../../../shared/mail-filing/application/mailFiling'
import { gmailMailbox } from '../../../../shared/mail-filing/infrastructure/gmailMailbox'
import { NO_RATES } from '../../../../shared/money/rateBook'
import type { RecipeMisfit } from '../../../../shared/recipes/domain/recipe'
import type { RecipeRun } from '../../../../shared/recipes/domain/runRecipe'
import { words as recipeWords } from '../../../../shared/recipes/domain/words'
import { fileNameFits, readRecipeFile } from '../../../../shared/recipes/infrastructure/recipeFile'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import { plural } from '../../../../shared/text/translation'

export const MAIL_SCOPE: GoogleScope = 'gmail.readonly'

/** Where the step's line links, the card on Settings, General, which lists what the last run read. */
const MAIL_LIST_LINK = { label: words.step.seeList, to: `${INVESTMENTS_GENERAL_ROUTE}#mail` } as const

const state = shallowReactive<{ plan: MailReportPlan | null; stopped: string | null }>({ plan: null, stopped: null })

/** What this page already made of each file. A sync on a timer would otherwise fetch every file of the window again. */
const known = new Map<string, RecipeRun>()

export function mailReaderOf(book: InvestmentBook | null | undefined): MailReader | null {
  return book?.mailReaders.find((reader) => reader.recipe === IBKR_FLEX_RECIPE.id) ?? null
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

/** A report's mail read into rows, oldest file first, for the dry run. */
function rowsOfPlan(plan: MailReportPlan, reader: MailReader): WorkbookRows {
  return reportRows(
    IBKR_FLEX_RECIPE,
    plan.mails.flatMap((mail) => (mail.kind === 'read' ? [mail.file] : [])),
    reader,
  )
}

/** What to tick in the Flex Query where a section or a field is missing, or nothing. */
function fixOf(misfit: RecipeMisfit): string {
  return misfit.kind === 'no-section' || misfit.kind === 'no-column' ? ` ${words.step.fixes[misfit.kind]}` : ''
}

/** Why a file does not fit IBKR's recipe, with what to tick in the Flex Query where a section or a field is missing. */
export function misfitLine(fileName: string, misfit: RecipeMisfit): string {
  return `${words.step.misfit(fileName, plural(recipeWords.misfit(1, misfit, IBKR_FLEX_RECIPE.name), 1))}${fixOf(misfit)}`
}

/** The files that fail the same way as one line, with the fix once. */
function misfitLines(plan: MailReportPlan): string[] {
  const byMisfit = new Map<string, { readonly misfit: RecipeMisfit; readonly fileNames: string[] }>()
  for (const mail of plan.mails) {
    if (mail.kind !== 'misfit') continue
    const key = JSON.stringify(mail.misfit)
    const group = byMisfit.get(key) ?? { misfit: mail.misfit, fileNames: [] }
    group.fileNames.push(mail.fileName)
    byMisfit.set(key, group)
  }
  return [...byMisfit.values()].map(({ misfit, fileNames }) => {
    const count = fileNames.length
    if (count === 1) return misfitLine(fileNames[0]!, misfit)
    return `${plural(words.step.filesMisfit(count), count)} ${plural(recipeWords.misfit(count, misfit, IBKR_FLEX_RECIPE.name), count)}.${fixOf(misfit)}`
  })
}

/** The step's line: what it read, what waits, and the files that did not fit, grouped by why. */
function planLine(plan: MailReportPlan, news: ReportNews): string {
  const read = plan.mails.length
  const noFile = plan.mails.filter((mail) => mail.kind === 'no-file').length
  return [
    read === 0 ? `${mailWords.noMail}.` : `${plural(mailWords.mails(read), read)}: ${mailWords.news(news.fresh, news.changed, news.asked)}.`,
    noFile === 0 ? '' : `${plural(mailWords.noFile(noFile, 'XML'), noFile)}.`,
    ...misfitLines(plan),
  ]
    .filter((part) => part !== '')
    .join(' ')
}

export interface MailReports {
  readonly state: Readonly<{ plan: MailReportPlan | null; stopped: string | null }>
  readonly reader: ComputedRef<MailReader | null>
  /** Null before a sync of this page read the mail. */
  readonly reading: ComputedRef<WorkbookRows | null>
  readonly news: ComputedRef<ReportNews | null>
  /** A real mail fitted the recipe, on this page or when an earlier record was made from one. */
  readonly confirmed: ComputedRef<boolean>
}

/** The mail step's last run, shared by the whole page, and what it holds for the person now. */
export function useMailReports(): MailReports {
  const store = useInvestmentsBooks()
  const { sources } = usePortfolio()
  const book = computed(() => store.state.workbook?.book ?? null)
  const reader = computed(() => mailReaderOf(book.value))
  const reading = computed(() => (state.plan === null || reader.value === null ? null : rowsOfPlan(state.plan, reader.value)))
  return {
    state: shallowReadonly(state),
    reader,
    reading,
    news: computed(() => (reading.value === null || book.value === null ? null : reportNews(reading.value, book.value, sources.value?.rates ?? NO_RATES))),
    confirmed: computed(() => (book.value !== null && newestReportDay(book.value) !== null) || (state.plan?.mails.some((mail) => mail.kind === 'read') ?? false)),
  }
}

/** The mail step of Investments' sync, there only while the reader is on. It reads what is new and writes nothing, since the person accepts it. A file that does not fit fails the step with why. */
export const MAIL_STEP: SyncStep = {
  id: 'ibkr-mail',
  label: words.step.label,
  scopes: () => [MAIL_SCOPE],
  startLine: words.step.searching,
  on: () => true,
  async run() {
    const { state: books } = useInvestmentsBooks()
    const { workbook, choice } = books
    const reader = mailReaderOf(workbook?.book)
    if (workbook === null || reader === null || choice?.source !== 'drive') {
      return { kind: 'done', line: words.step.beforeBooks, writeId: null, link: null }
    }
    const newest = newestReportDay(workbook.book)
    const newestDay = newest === null ? null : parseCivilDate(newest)
    const ports: Omit<MailReportPorts, 'mailbox'> = {
      recipe: IBKR_FLEX_RECIPE,
      reader,
      sinceStart: startOfDayIn(reader.since, deviceTimeZone()),
      newest: newestDay === null ? null : startOfDayIn(newestDay, deviceTimeZone()),
      fits: (name) => fileNameFits(IBKR_FLEX_RECIPE, name),
      readFile: (bytes) => readRecipeFile(IBKR_FLEX_RECIPE, bytes),
      known,
    }
    try {
      state.plan = await readMailReports({ ...ports, mailbox: await openMailbox() })
      state.stopped = null
    } catch (failure) {
      state.plan = null
      state.stopped = isUnauthorized(failure) ? words.step.stopped : failure instanceof Error ? failure.message : String(failure)
      throw failure
    }
    const line = planLine(state.plan, reportNews(rowsOfPlan(state.plan, reader), workbook.book, usePortfolio().sources.value?.rates ?? NO_RATES))
    return state.plan.mails.some((mail) => mail.kind === 'misfit') ? { kind: 'failed', line, link: MAIL_LIST_LINK } : { kind: 'done', line, writeId: null, link: MAIL_LIST_LINK }
  },
}
