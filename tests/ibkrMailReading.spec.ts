// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { readingKeeper, runsOfPlan } from '../src/apps/investments/mail/application/keptReading'
import type { MailReadingCache, MailReportPlan } from '../src/apps/investments/mail/application/mailReports'
import { IBKR_FLEX_FINGERPRINT, IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { sampleFlexReport } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import { MAIL_READING_DATABASE_PREFIX, openMailReadingCache } from '../src/apps/investments/mail/infrastructure/mailReadingCache'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import type { RecipeRun } from '../src/shared/recipes/domain/runRecipe'
import { readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'

const DAY = parseCivilDate('2026-10-05')!
const READ_AT = '2026-10-06T07:02:00.000Z'

function runOfReport(): Extract<RecipeRun, { readonly kind: 'read' }> {
  const read = readRecipeFile(IBKR_FLEX_RECIPE, new TextEncoder().encode(sampleFlexReport([DAY])).buffer as ArrayBuffer)
  if (read.kind !== 'read') throw new Error('It did not read.')
  const run = runRecipe(IBKR_FLEX_RECIPE, read)
  if (run.kind !== 'read') throw new Error('It does not fit.')
  return run
}

/** A sync's reading: a report read into rows with their decimals, a file that does not fit and a mail with no file. */
function plan(): MailReportPlan {
  return {
    window: { from: 1_780_000_000_000, after: 'since' },
    query: 'from:(reports@broker.example.com) has:attachment',
    mails: [
      { mail: { id: 'mail-1', subject: 'Activity Flex', date: 1_780_000_100_000 }, kind: 'read', file: { fileName: 'flex.xml', run: runOfReport() } },
      { mail: { id: 'mail-2', subject: 'Activity Flex', date: 1_780_000_200_000 }, kind: 'misfit', fileName: 'other.xml', misfit: { kind: 'no-section', section: 'Trades' } },
      { mail: { id: 'mail-3', subject: 'Statement', date: 1_780_000_300_000 }, kind: 'no-file' },
    ],
  }
}

const opened: string[] = []

function cacheOf(fileId: string): MailReadingCache {
  opened.push(fileId)
  return openMailReadingCache(fileId)
}

async function databases(): Promise<string[]> {
  return (await Dexie.getDatabaseNames()).filter((name) => name.startsWith(MAIL_READING_DATABASE_PREFIX)).sort()
}

afterEach(async () => {
  for (const fileId of opened.splice(0)) await Dexie.delete(`${MAIL_READING_DATABASE_PREFIX}${fileId}`)
})

describe('the mail reading kept in this browser', () => {
  it('reads back what a sync read, its decimals included, in a database of the Investments file of its own', async () => {
    const cache = cacheOf('investments-1')
    expect(await cache.read()).toBeNull()
    await cache.replace({ recipe: IBKR_FLEX_FINGERPRINT, readAt: READ_AT, plan: plan() })
    const reopened = openMailReadingCache('investments-1')
    expect(await reopened.read()).toEqual({ recipe: IBKR_FLEX_FINGERPRINT, readAt: READ_AT, plan: plan() })
    expect(await databases()).toEqual([`${MAIL_READING_DATABASE_PREFIX}investments-1`])
    reopened.close()
  })

  it('shows the reading kept of the file the books are on', async () => {
    const keeper = readingKeeper(cacheOf, IBKR_FLEX_FINGERPRINT)
    expect(await keeper.open('investments-1')).toBeNull()
    await keeper.keep('investments-1', plan(), READ_AT)
    const later = readingKeeper(cacheOf, IBKR_FLEX_FINGERPRINT)
    expect(await later.open('investments-1')).toEqual({ recipe: IBKR_FLEX_FINGERPRINT, readAt: READ_AT, plan: plan() })
  })

  it('reads a reading kept by another version of the recipe as none, and drops it', async () => {
    await cacheOf('investments-1').replace({ recipe: 'an older recipe', readAt: READ_AT, plan: plan() })
    const keeper = readingKeeper(cacheOf, IBKR_FLEX_FINGERPRINT)
    expect(await keeper.open('investments-1')).toBeNull()
    expect(await openMailReadingCache('investments-1').read()).toBeNull()
  })

  it('drops the reading when the mail is stopped or no account takes it', async () => {
    const keeper = readingKeeper(cacheOf, IBKR_FLEX_FINGERPRINT)
    await keeper.open('investments-1')
    await keeper.keep('investments-1', plan(), READ_AT)
    await keeper.drop()
    expect(await keeper.open('investments-1')).toBeNull()
    await keeper.keep('investments-1', plan(), READ_AT)
    expect(await keeper.open('investments-1')).toMatchObject({ readAt: READ_AT })
  })

  it("drops the old file's reading when the books move to another file, and keeps none for books kept in this browser", async () => {
    const keeper = readingKeeper(cacheOf, IBKR_FLEX_FINGERPRINT)
    await keeper.open('investments-1')
    await keeper.keep('investments-1', plan(), READ_AT)
    expect(await keeper.open('investments-2')).toBeNull()
    expect(await databases()).not.toContain(`${MAIL_READING_DATABASE_PREFIX}investments-1`)
    await keeper.keep('investments-1', plan(), READ_AT)
    expect(await databases()).not.toContain(`${MAIL_READING_DATABASE_PREFIX}investments-1`)
    expect(await keeper.open(null)).toBeNull()
    await keeper.keep('investments-2', plan(), READ_AT)
    expect(await databases()).toEqual([])
  })

  it('knows each file a kept reading made, so a sync after a reload fetches none of them again', () => {
    expect([...runsOfPlan(plan()).entries()]).toEqual([
      ['mail-1/flex.xml', runOfReport()],
      ['mail-2/other.xml', { kind: 'misfit', misfit: { kind: 'no-section', section: 'Trades' } }],
    ])
  })
})
