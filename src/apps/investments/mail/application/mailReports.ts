import type { ReportFile } from '../domain/reportRows'
import type { MailReader } from '../../workbook/domain/mailReader'
import type { Mailbox } from '../../../../shared/mail-filing/application/mailFiling'
import { readMail } from '../../../../shared/mail-filing/application/mailReading'
import type { PlannedMail } from '../../../../shared/mail-filing/application/mailFiling'
import { mailQuery, mailWindow } from '../../../../shared/mail-filing/domain/mailSource'
import type { MailWindow } from '../../../../shared/mail-filing/domain/mailSource'
import type { Recipe, RecipeMisfit, SourceRows } from '../../../../shared/recipes/domain/recipe'
import { runRecipe } from '../../../../shared/recipes/domain/runRecipe'
import type { RecipeRun } from '../../../../shared/recipes/domain/runRecipe'

/** What a mail held: rows of its report, a file that does not fit the recipe, or no file of the recipe's format. */
export type ReportMail = { readonly mail: PlannedMail } & (
  { readonly kind: 'read'; readonly file: ReportFile } | { readonly kind: 'misfit'; readonly fileName: string; readonly misfit: RecipeMisfit } | { readonly kind: 'no-file' }
)

/** What one sync's step found of a recipe's mail. */
export interface MailReportPlan {
  readonly window: MailWindow
  readonly query: string
  readonly mails: readonly ReportMail[]
}

/** A file's rows by the recipe's sections, or why it is not that kind of file. */
export type SourceReading = { readonly kind: 'read'; readonly rows: SourceRows } | { readonly kind: 'misfit'; readonly misfit: RecipeMisfit }

export interface MailReportPorts {
  readonly mailbox: Mailbox
  readonly recipe: Recipe
  readonly reader: MailReader
  /** The start of the reader's start day, in epoch milliseconds. */
  readonly sinceStart: number
  /** The start of the newest day a record of this report is dated, or null while none is. */
  readonly newest: number | null
  /** Whether an attachment's name is the recipe's format. */
  fits(name: string): boolean
  readFile(bytes: ArrayBuffer): SourceReading
  /** What an earlier sync of this page made of a file, by its mail and attachment, so its bytes are not fetched again. */
  readonly known: Map<string, RecipeRun>
}

/**
 * Reads what a reader's search finds into rows, filing nothing and marking nothing. Each file of the recipe's format is
 * run through the recipe, and one that does not fit says so without stopping the others. The search reaches back a week
 * before the newest record of this report, so a missed file heals, and no further than the reader's start day.
 */
export async function readMailReports(ports: MailReportPorts): Promise<MailReportPlan> {
  const { mailbox, recipe, reader, known } = ports
  const window = mailWindow(ports.newest, ports.sinceStart)
  const query = mailQuery(reader, window)
  const perMail = await readMail(mailbox, query, async (message, files): Promise<readonly ReportMail[]> => {
    const mail = { id: message.id, subject: message.subject, date: message.date }
    const fitting = files.filter((file) => ports.fits(file.attachment.name))
    if (fitting.length === 0) return [{ mail, kind: 'no-file' }]
    return Promise.all(
      fitting.map(async ({ attachment, bytes }): Promise<ReportMail> => {
        const seen = `${message.id}/${attachment.name}`
        const run = known.get(seen) ?? runOf(recipe, ports.readFile(await bytes()))
        known.set(seen, run)
        return run.kind === 'misfit' ? { mail, kind: 'misfit', fileName: attachment.name, misfit: run.misfit } : { mail, kind: 'read', file: { fileName: attachment.name, run } }
      }),
    )
  })
  return { window, query, mails: perMail.flat() }
}

function runOf(recipe: Recipe, reading: SourceReading): RecipeRun {
  return reading.kind === 'misfit' ? { kind: 'misfit', misfit: reading.misfit } : runRecipe(recipe, reading.rows)
}

/** A report the person picked, run through the recipe under its name, or why it does not fit. */
export function pickedReport(
  recipe: Recipe,
  fileName: string,
  reading: SourceReading,
): { readonly kind: 'read'; readonly file: ReportFile } | { readonly kind: 'misfit'; readonly misfit: RecipeMisfit } {
  const run = runOf(recipe, reading)
  return run.kind === 'misfit' ? run : { kind: 'read', file: { fileName, run } }
}
