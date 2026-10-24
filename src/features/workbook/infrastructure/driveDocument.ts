import { parseCivilDate, today } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { FOLDER_MIME_TYPE } from '../../../shared/google/driveClient'
import type { DriveFile, DriveRevision } from '../../../shared/google/driveClient'
import type { DocumentHome, DocumentSave, Rewrite, StoredDocument } from '../application/documentHome'

/** What a media upload of the document gave: the revision it made, or Drive's refusal because the file already keeps 200 revisions. */
export type DocumentUpload = { readonly kind: 'uploaded'; readonly revision: string } | { readonly kind: 'kept-revisions-full' }

/** The Drive requests the document's home makes, over Google's API or the fake Drive. */
export interface DocumentDrive {
  headRevision(fileId: string): Promise<string>
  /** The content of the head revision. */
  download(fileId: string): Promise<string>
  /** Replaces the content and keeps the new revision forever. */
  upload(fileId: string, text: string): Promise<DocumentUpload>
  revisions(fileId: string): Promise<readonly DriveRevision[]>
  downloadRevision(fileId: string, revisionId: string): Promise<string>
  unkeepRevision(fileId: string, revisionId: string): Promise<void>
  parentOf(fileId: string): Promise<string>
  children(folderId: string): Promise<readonly Pick<DriveFile, 'id' | 'name' | 'mimeType'>[]>
  createFolder(parentId: string, name: string): Promise<string>
  createFile(parentId: string, name: string, text: string, appProperties?: Readonly<Record<string, string>>): Promise<{ readonly id: string; readonly revision: string }>
  trash(fileId: string): Promise<void>
  /** The ids of the files the app gave this property, the trashed ones left out. */
  findByAppProperty(key: string, value: string): Promise<readonly string[]>
}

/** The `appProperties` key that names which app of ledgerboard a document belongs to. */
const APP_PROPERTY = 'ledgerboard'
/** Drive refuses a 201st kept revision, so the app lets go of its oldest beyond this many. */
const KEPT_REVISIONS = 100
const DAILY_BACKUPS = 30
const BACKUPS_FOLDER = 'backups'
/** How often a save lists the revisions before it gives up on a file that keeps changing under it. */
const POST_CHECKS = 5
const OUTSIDE_EDIT = 'The file changed outside the app during this save. Check the backups folder.'

function documentName(app: string): string {
  return `ledgerboard-${app}.json`
}

function backupName(app: string, day: CivilDate): string {
  return `ledgerboard-${app}-${day}.json`
}

/** Revisions by modified time, then id. Drive lists them by modified time, which need not be the order they landed in. */
function byModifiedTime(left: DriveRevision, right: DriveRevision): number {
  return Date.parse(left.modifiedTime) - Date.parse(right.modifiedTime) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}

/** Creates the document in the folder the person picked, named for the app and marked with it, so another device finds it by search. */
export async function createDriveDocument(drive: DocumentDrive, folderId: string, app: string, text: string): Promise<{ readonly fileId: string; readonly document: StoredDocument }> {
  const created = await drive.createFile(folderId, documentName(app), text, { [APP_PROPERTY]: app })
  return { fileId: created.id, document: { revision: created.revision, text } }
}

/** The id of the document the app made on any device, or null when the search finds none. */
export async function findDriveDocument(drive: DocumentDrive, app: string): Promise<string | null> {
  const found = await drive.findByAppProperty(APP_PROPERTY, app)
  if (found.length > 1) {
    throw new Error(`Drive holds ${found.length} files the app made as ${documentName(app)}, so it cannot tell which one holds the books. Trash all but one in Drive.`)
  }
  return found[0] ?? null
}

/**
 * The document as one file on Drive. Drive refuses no stale upload, so a save checks the head
 * revision before its upload and lists the revisions after it. When another save landed since the
 * base, the save whose upload is the head landed last and replaced the other, so only its device
 * runs its write again on the other save and uploads that, or puts the other save back and is refused.
 */
export function driveDocumentHome(drive: DocumentDrive, fileId: string, app: string, day: () => CivilDate = today): DocumentHome {
  let backedUpOn: CivilDate | null = null

  async function unkeepOldest(listed: readonly DriveRevision[]): Promise<void> {
    const kept = listed.filter((revision) => revision.keepForever).sort(byModifiedTime)
    for (const revision of kept.slice(0, Math.max(0, kept.length - KEPT_REVISIONS))) {
      await drive.unkeepRevision(fileId, revision.id)
    }
  }

  async function upload(text: string): Promise<string> {
    const first = await drive.upload(fileId, text)
    if (first.kind === 'uploaded') {
      return first.revision
    }
    await unkeepOldest(await drive.revisions(fileId))
    const second = await drive.upload(fileId, text)
    if (second.kind === 'uploaded') {
      return second.revision
    }
    throw new Error('Drive keeps 200 revisions of the file and refused this save, although the app let go of its oldest. Try again in a minute.')
  }

  async function backupsFolder(): Promise<string> {
    const parentId = await drive.parentOf(fileId)
    const existing = (await drive.children(parentId)).find((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === BACKUPS_FOLDER)
    return existing?.id ?? (await drive.createFolder(parentId, BACKUPS_FOLDER))
  }

  /** The first save of a day keeps the document as it stood before it. The last 30 dailies stay, and so does the first of each month. */
  async function backUp(base: StoredDocument): Promise<void> {
    const on = day()
    if (backedUpOn === on) {
      return
    }
    const folderId = await backupsFolder()
    const entries = await drive.children(folderId)
    const name = backupName(app, on)
    if (!entries.some((entry) => entry.name === name)) {
      await drive.createFile(folderId, name, base.text)
    }
    const backups = entries.flatMap((entry) => {
      const backupDay = entry.mimeType === FOLDER_MIME_TYPE ? null : backupDayOf(entry.name)
      return backupDay === null || backupDay === on ? [] : [{ id: entry.id, day: backupDay }]
    })
    const days = [...new Set([on, ...backups.map((backup) => backup.day)])].sort().reverse()
    const kept = new Set([...days.slice(0, DAILY_BACKUPS), ...firstOfEachMonth(days)])
    for (const backup of backups.filter((candidate) => !kept.has(candidate.day))) {
      await drive.trash(backup.id)
    }
    backedUpOn = on
  }

  function backupDayOf(name: string): CivilDate | null {
    const prefix = `ledgerboard-${app}-`
    return name.startsWith(prefix) && name.endsWith('.json') ? parseCivilDate(name.slice(prefix.length, -'.json'.length)) : null
  }

  /**
   * The check after an upload. A revision since the base that is neither the base nor one of this
   * save's is another save. The head comes from `files.get` after the list, since list order need
   * not be landing order, and a head the list lacks means a save landed after the list. A save
   * that landed before this one's upload is always on the list, so the device that landed last
   * sees every save it replaced.
   */
  async function settle(base: StoredDocument, uploaded: StoredDocument, rewrite: (other: string) => Promise<Rewrite>): Promise<DocumentSave> {
    const mine = new Set([uploaded.revision])
    let since = base.revision
    let latest = uploaded
    for (let check = 0; check < POST_CHECKS; check += 1) {
      const listed = await drive.revisions(fileId)
      const head = await drive.headRevision(fileId)
      const start = listed.find((revision) => revision.id === since)
      const own = listed.find((revision) => revision.id === latest.revision)
      if (start === undefined) {
        throw new Error(OUTSIDE_EDIT)
      }
      if (own === undefined || !listed.some((revision) => revision.id === head)) {
        continue
      }
      const others = listed.filter((revision) => !mine.has(revision.id) && byModifiedTime(revision, start) > 0)
      if (others.some((revision) => !revision.keepForever)) {
        throw new Error(OUTSIDE_EDIT)
      }
      if (others.length === 0 || head !== own.id) {
        await unkeepOldest(listed)
        return { kind: 'saved', document: latest }
      }
      const replaced = others.sort(byModifiedTime).at(-1)!
      const replacedText = await drive.downloadRevision(fileId, replaced.id)
      const rewritten = await rewrite(replacedText)
      if (rewritten.kind === 'refused') {
        await upload(replacedText)
        return rewritten
      }
      latest = { revision: await upload(rewritten.text), text: rewritten.text }
      mine.add(latest.revision)
      since = replaced.id
    }
    throw new Error('The file kept changing during this save. Sync to see what it holds now.')
  }

  return {
    async read(cached) {
      const revision = await drive.headRevision(fileId)
      return cached?.revision === revision ? cached : { revision, text: await drive.download(fileId) }
    },

    async save(base, text, rewrite) {
      await backUp(base)
      if ((await drive.headRevision(fileId)) !== base.revision) {
        return { kind: 'moved' }
      }
      return settle(base, { revision: await upload(text), text }, rewrite)
    },
  }
}

/** Of days newest first, the earliest of each month. */
function firstOfEachMonth(days: readonly CivilDate[]): CivilDate[] {
  const firsts = new Map<string, CivilDate>()
  for (const backupDay of days) {
    firsts.set(backupDay.slice(0, 7), backupDay)
  }
  return [...firsts.values()]
}
