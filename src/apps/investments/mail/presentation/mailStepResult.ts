import type { MailReportPlan } from '../application/mailReports'
import type { MailedImport } from '../application/reportImport'
import { IBKR_FLEX_RECIPE } from '../domain/ibkrFlexRecipe'
import type { ReportNews } from '../domain/mailReview'
import type { ImportWait } from '../domain/unattendedImport'
import { words as mailWords } from '../domain/words'
import { words } from './words'
import { words as refusalWords } from '../../holdings/application/words'
import { INVESTMENTS_GENERAL_ROUTE, INVESTMENTS_OVERVIEW_ROUTE } from '../../overview/presentation/investmentLinks'
import type { RecipeMisfit } from '../../../../shared/recipes/domain/recipe'
import { words as recipeWords } from '../../../../shared/recipes/domain/words'
import type { StepLink, StepResult } from '../../../../shared/sync/application/syncRun'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'

/** Where the step's line links, the card on Settings, General, which lists what the last run read. */
export const MAIL_LIST_LINK = { label: words.step.seeList, to: `${INVESTMENTS_GENERAL_ROUTE}#mail` } as const

/** The Overview, whose banner opens the review of what the report left, counting the records that wait. */
function reviewLink(count: number): StepLink {
  return { label: plural(words.step.review(count), count), to: INVESTMENTS_OVERVIEW_ROUTE }
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

/** What it read, what it imported and what is left, then the mails with no file and the files that did not fit, grouped by why. */
function planLine(plan: MailReportPlan, news: ReportNews, importedRecords: number): string {
  const read = plan.mails.length
  const noFile = plan.mails.filter((mail) => mail.kind === 'no-file').length
  const left = news.fresh + news.changed + news.asked === 0 ? [] : [mailWords.news(news.fresh, news.changed, news.asked)]
  const found = importedRecords === 0 ? mailWords.news(news.fresh, news.changed, news.asked) : [plural(words.step.imported(importedRecords), importedRecords), ...left].join(', ')
  return [read === 0 ? `${mailWords.noMail}.` : `${plural(mailWords.mails(read), read)}: ${found}.`, noFile === 0 ? '' : `${plural(mailWords.noFile(noFile, 'XML'), noFile)}.`, ...misfitLines(plan)]
    .filter((part) => part !== '')
    .join(' ')
}

/** A wait the person has to act on. Rows they undid only stay out until they review them, and a file that does not fit fails the step. */
type HoldingWait = Exclude<ImportWait, { readonly kind: 'misfit' | 'undone' }>

function holds(wait: ImportWait): wait is HoldingWait {
  return wait.kind !== 'misfit' && wait.kind !== 'undone'
}

function waitText(wait: HoldingWait): string {
  switch (wait.kind) {
    case 'rates':
      return words.step.waits.rates(listInWords(wait.currencies))
    case 'instrument':
      return words.step.waits.instrument(listInWords([...new Set(wait.symbols)]))
    default:
      return words.step.waits[wait.kind]
  }
}

/** What the person has to do before the report goes in, or why its write was refused, or that rows they undid stay out. */
function outcomeLine(outcome: MailedImport): string {
  if (outcome.kind === 'refused') return outcome.reason === refusalWords.importKeyHeld ? words.step.importedElsewhere : words.step.refused(outcome.reason)
  if (outcome.kind !== 'waits') return ''
  const holding = outcome.waits.filter(holds)
  if (holding.length > 0) return words.step.waitsFor(listInWords(holding.map(waitText)))
  return outcome.waits.some((wait) => wait.kind === 'undone') ? words.step.undoneKept : ''
}

/**
 * The mail step's state once the mail is read. It waits only while something holds the report back for the person, such as an
 * account or a holding to pick, a question, rates that could not be fetched or a refused write. Rows that went in with a record
 * whose figures changed, or rows the person undid, leave it done with a link to the review. A file that does not fit fails it.
 */
export function mailStepResult(plan: MailReportPlan, outcome: MailedImport, news: ReportNews, writeId: number | null): StepResult {
  const line = [planLine(plan, news, outcome.kind === 'imported' ? outcome.records : 0), outcomeLine(outcome)].filter((part) => part !== '').join(' ')
  if (plan.mails.some((mail) => mail.kind === 'misfit')) return { kind: 'failed', line, link: MAIL_LIST_LINK }
  const left = news.fresh + news.changed + news.asked
  const link = left > 0 ? reviewLink(left) : MAIL_LIST_LINK
  const waits = outcome.kind === 'refused' || (outcome.kind === 'waits' && outcome.waits.some(holds))
  return { kind: waits ? 'waits' : 'done', line, writeId, link }
}
