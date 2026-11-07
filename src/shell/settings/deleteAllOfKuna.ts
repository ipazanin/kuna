import { placesStillHeld, removalWent } from '../../shared/storage/application/appData'
import type { AppData, DataPlace, RemovalReport } from '../../shared/storage/application/appData'
import { words as storageWords } from '../../shared/storage/application/words'
import { WorkbookWriteRefused } from '../../shared/storage/application/workbookWriteRefused'

/** What every app shares: the keys in this browser and in the Google account, and this browser's own settings. */
export type SharedThing = 'browser-keys' | 'google-keys' | 'browser-settings'

export interface KunaDeletionPorts {
  /** Resolves once no sync of the page is under way. */
  syncsOver(): Promise<void>
  syncing(): boolean
  forgetBrowserKeys(): void
  /** Deletes the keys files in the Google account for good, since Drive keeps no bin for an app's hidden folder. */
  deleteGoogleKeys(): Promise<void>
  /** Forgets this browser's settings, and the Google sign-in unless an app still keeps a file on Drive. */
  forgetBrowserSettings(): void
}

export interface AppPick {
  readonly data: AppData
  readonly places: readonly DataPlace[]
  /** Whether the backups Kuna made of this app's file go to the bin too. */
  readonly backups: boolean
}

export interface KunaDeletionReport {
  readonly apps: readonly { readonly data: AppData; readonly report: RemovalReport }[]
  readonly shared: readonly { readonly thing: SharedThing; readonly failure: string | null }[]
  /** Whether everything chosen went. */
  readonly complete: boolean
}

/** Whether the person typed the name, as a phone's keyboard may capitalise it or leave a space. */
export function nameTyped(typed: string, name: string): boolean {
  return typed.trim().toLowerCase() === name.toLowerCase()
}

/** What the person chose of each app that it still has after a failed delete. What they left unticked stays unticked, and a retry takes nothing more. */
export function picksStillHeld(chosen: Readonly<Record<string, readonly DataPlace[]>>, apps: readonly Pick<AppData, 'id' | 'held'>[]): Readonly<Record<string, readonly DataPlace[]>> {
  return Object.fromEntries(
    apps.flatMap((app) => {
      const held = app.held()
      return held === null ? [] : [[app.id, placesStillHeld(chosen[app.id] ?? [], held.places)]]
    }),
  )
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

/**
 * Deletes what was chosen, each app in turn and then what they share, the Google keys while the sign-in still stands. It waits for a sync under
 * way, and refuses with nothing done while a sync starts again or a save waits. One app's failure leaves that app as it was and the rest go on, and the report names each.
 */
export async function deleteAllOfKuna(ports: KunaDeletionPorts, picks: readonly AppPick[], things: readonly SharedThing[]): Promise<KunaDeletionReport> {
  await ports.syncsOver()
  if (ports.syncing() || picks.some(({ data }) => data.held()?.busy === true)) {
    throw new WorkbookWriteRefused(storageWords.busy)
  }
  const apps: { data: AppData; report: RemovalReport }[] = []
  for (const { data, places, backups } of picks) {
    apps.push({ data, report: await data.remove(places, backups) })
  }
  const shared: { thing: SharedThing; failure: string | null }[] = []
  async function run(thing: SharedThing, work: () => void | Promise<void>): Promise<void> {
    if (!things.includes(thing)) return
    try {
      await work()
      shared.push({ thing, failure: null })
    } catch (failure) {
      shared.push({ thing, failure: messageOf(failure) })
    }
  }
  await run('google-keys', () => ports.deleteGoogleKeys())
  await run('browser-keys', () => ports.forgetBrowserKeys())
  await run('browser-settings', () => ports.forgetBrowserSettings())
  const complete = apps.every(({ report }) => removalWent(report)) && shared.every(({ failure }) => failure === null)
  return { apps, shared, complete }
}
