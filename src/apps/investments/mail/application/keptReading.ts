import type { KeptReading, MailReadingCache, MailReportPlan } from './mailReports'
import type { RecipeRun } from '../../../../shared/recipes/domain/runRecipe'

/**
 * The last good reading of an Investments file's report mail, kept in this browser so a reload, an expired sign-in or a
 * failed sync still shows what waits. It belongs to one file at a time: moving the books to another file drops the old
 * file's reading, and books kept in this browser have none.
 */
export interface ReadingKeeper {
  /** Moves to the file the books are on, or to none, and gives that file's kept reading when it was read by this recipe. */
  open(fileId: string | null): Promise<KeptReading | null>
  /** Keeps a sync's reading of a file, while that file is the one open. */
  keep(fileId: string, plan: MailReportPlan, readAt: string): Promise<void>
  /** Drops the file's reading, as when no account takes the mail or the mail is stopped. */
  drop(): Promise<void>
}

/** A keeper over one cache per file, which reads a kept reading of another recipe as none and drops it. Each call waits for the one before. */
export function readingKeeper(cacheOf: (fileId: string) => MailReadingCache, recipe: string): ReadingKeeper {
  let current: { readonly fileId: string; readonly cache: MailReadingCache } | null = null
  let last: Promise<unknown> = Promise.resolve()
  const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
    const next = last.then(work, work)
    last = next.catch(() => null)
    return next
  }
  return {
    open: (fileId) =>
      inTurn(async () => {
        if (current?.fileId === fileId) return keptOf(current.cache, recipe)
        if (current !== null) {
          const left = current.cache
          current = null
          await left.delete()
          left.close()
        }
        if (fileId === null) return null
        current = { fileId, cache: cacheOf(fileId) }
        return keptOf(current.cache, recipe)
      }),
    keep: (fileId, plan, readAt) => inTurn(async () => (current?.fileId === fileId ? current.cache.replace({ recipe, readAt, plan }) : undefined)),
    drop: () => inTurn(async () => current?.cache.delete()),
  }
}

async function keptOf(cache: MailReadingCache, recipe: string): Promise<KeptReading | null> {
  const kept = await cache.read()
  if (kept === null || kept.recipe === recipe) return kept
  await cache.delete()
  return null
}

/** What a kept reading made of each file, by its mail and attachment, so a sync after a reload fetches none of them again. */
export function runsOfPlan(plan: MailReportPlan): Map<string, RecipeRun> {
  const runs = new Map<string, RecipeRun>()
  for (const mail of plan.mails) {
    if (mail.kind === 'read') runs.set(`${mail.mail.id}/${mail.file.fileName}`, mail.file.run)
    else if (mail.kind === 'misfit') runs.set(`${mail.mail.id}/${mail.fileName}`, { kind: 'misfit', misfit: mail.misfit })
  }
  return runs
}
