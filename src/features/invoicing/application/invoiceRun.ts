import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import type { FilingPath } from '../domain/invoiceFiling'
import type { InvoiceMail } from '../domain/invoiceMail'

/** A file or folder in Drive as the app sees it. */
export interface DriveEntry {
  readonly id: string
  readonly name: string
  readonly folder: boolean
}

/**
 * Drive as a `drive.file` token reaches it: only files and folders the app made or the person
 * picked. A folder another app made stays out of a listing until it is picked once.
 */
export interface InvoiceDrive {
  /** What the app can see inside a folder. */
  children(folderId: string): Promise<readonly DriveEntry[]>
  /** Opens Google's Picker on folders, inside `parentId` or from My Drive when it is null. Empty when cancelled. Picking grants the app what was picked. */
  pickFolders(parentId: string | null, title: string): Promise<readonly DriveEntry[]>
  createFolder(parentId: string, name: string): Promise<DriveEntry>
  createPdf(folderId: string, name: string, pdf: Uint8Array): Promise<DriveEntry>
  /** Gives a file the app can see new contents, keeping its id and links. */
  replacePdf(fileId: string, pdf: Uint8Array): Promise<void>
}

export interface MailDrafts {
  /** Saves a draft with the PDF attached. It is never sent. */
  create(mail: InvoiceMail, attachment: { readonly fileName: string; readonly pdf: Uint8Array }): Promise<void>
}

/** Where the PDF goes: the deepest path folder found, the path folders still to make under it, and a file of the same name the app can see there. */
export interface FilingTarget {
  readonly folderId: string
  readonly toCreate: readonly string[]
  readonly fileName: string
  readonly existing: DriveEntry | null
}

export type FolderLookup =
  | { readonly kind: 'found'; readonly target: FilingTarget }
  /** No folder of the name is in view and none was picked. `path` names it with its parents, such as 2026/2026-10. */
  | { readonly kind: 'hidden'; readonly segment: string; readonly path: string }

/** The line the Picker shows above the folders inside a path folder's parent. */
export function pickerTitleFor(segment: string): string {
  return `Pick the existing ${segment} folder. Pick every folder you see beside it too, so the app does not ask again.`
}

/**
 * Finds each folder of the path by name among what the app can see, from the picked invoice folder
 * down. A folder another app made, such as the invoice generator, is not in view until the person
 * picks it, and making a second one of the same name would split the invoices of a month. So a
 * folder that is not in view opens the Picker on its parent, and only a path in `create`, which the
 * person chose to make, is made, later by the filing step. A folder picked once stays in view.
 */
export async function locateFiling(drive: InvoiceDrive, rootId: string, path: FilingPath, create: ReadonlySet<string>): Promise<FolderLookup> {
  let current = rootId
  for (const [index, segment] of path.folders.entries()) {
    const prefix = path.folders.slice(0, index + 1).join('/')
    if (create.has(prefix)) {
      return { kind: 'found', target: { folderId: current, toCreate: path.folders.slice(index), fileName: path.fileName, existing: null } }
    }
    const named = (entries: readonly DriveEntry[]): DriveEntry | undefined => entries.find((entry) => entry.folder && entry.name === segment)
    const found = named(await drive.children(current)) ?? named(await drive.pickFolders(current, pickerTitleFor(segment)))
    if (found === undefined) {
      return { kind: 'hidden', segment, path: prefix }
    }
    current = found.id
  }
  const existing = (await drive.children(current)).find((entry) => !entry.folder && entry.name === path.fileName) ?? null
  return { kind: 'found', target: { folderId: current, toCreate: [], fileName: path.fileName, existing } }
}

export type RunStepKind = 'file' | 'download' | 'draft' | 'register'

export interface RunStep {
  readonly kind: RunStepKind
  status: 'waiting' | 'done' | 'failed'
  /** What the step did or why it failed, for the person. */
  note: string
}

/** What one run writes, worked out before anything is written. */
export interface RunPlan {
  readonly pdf: Uint8Array
  readonly fileName: string
  /** Null when there is no Drive to file in, as with a workbook kept in this browser. */
  filing: FilingTarget | null
  /** A re-export gives the PDF of the same name new contents. */
  readonly replace: boolean
  /** The draft's mail. Null when the person left the draft off. */
  readonly draft: InvoiceMail | null
  /** The register change, or null when a re-export changed nothing the register holds. */
  readonly register: TabRowsChange | null
}

export interface RunPorts {
  readonly drive: InvoiceDrive | null
  readonly drafts: MailDrafts | null
  download(pdf: Uint8Array, fileName: string): void
  writeRegister(change: TabRowsChange): Promise<void>
}

/**
 * The steps in the order they run: file the PDF, or hand it to the browser to save, then the draft,
 * then the register row. Without the draft the PDF is also saved, so it can be attached by hand.
 */
export function runStepsOf(plan: RunPlan): RunStep[] {
  const kinds: RunStepKind[] = [
    ...(plan.filing === null ? [] : ['file' as const]),
    ...(plan.filing === null || plan.draft === null ? ['download' as const] : []),
    ...(plan.draft === null ? [] : ['draft' as const]),
    ...(plan.register === null ? [] : ['register' as const]),
  ]
  return kinds.map((kind) => ({ kind, status: 'waiting', note: '' }))
}

async function fileThePdf(plan: RunPlan, drive: InvoiceDrive): Promise<string> {
  let target = plan.filing!
  while (target.toCreate.length > 0) {
    const [name, ...rest] = target.toCreate as [string, ...string[]]
    const made = await drive.createFolder(target.folderId, name)
    target = { ...target, folderId: made.id, toCreate: rest }
    plan.filing = target
  }
  const existing = (await drive.children(target.folderId)).find((entry) => !entry.folder && entry.name === plan.fileName) ?? null
  if (existing !== null && !plan.replace) {
    throw new Error(`${plan.fileName} is already in the folder, and the app does not overwrite an invoice. Use Re-export on the invoice to replace it.`)
  }
  if (existing !== null) {
    await drive.replacePdf(existing.id, plan.pdf)
    return `Replaced ${plan.fileName}.`
  }
  await drive.createPdf(target.folderId, plan.fileName, plan.pdf)
  return plan.replace
    ? `Filed ${plan.fileName}. The app could not see an earlier PDF of this name, so if the old generator filed one, delete it in Drive.`
    : `Filed ${plan.fileName}.`
}

/**
 * Runs every step not done yet, in order, and stops at the first that fails, which keeps its
 * reason. Calling it again retries from there, so a step that went through is never repeated.
 */
export async function continueRun(plan: RunPlan, steps: RunStep[], ports: RunPorts): Promise<void> {
  for (const step of steps) {
    if (step.status === 'done') continue
    try {
      step.note = await runStep(step.kind, plan, ports)
      step.status = 'done'
    } catch (failure) {
      step.status = 'failed'
      step.note = failure instanceof Error ? failure.message : String(failure)
      return
    }
  }
}

async function runStep(kind: RunStepKind, plan: RunPlan, ports: RunPorts): Promise<string> {
  switch (kind) {
    case 'file':
      if (ports.drive === null) throw new Error('There is no Google Drive to file in.')
      return fileThePdf(plan, ports.drive)
    case 'download':
      ports.download(plan.pdf, plan.fileName)
      return `Saved ${plan.fileName} through the browser.`
    case 'draft':
      if (ports.drafts === null || plan.draft === null) throw new Error('Gmail access was not granted.')
      await ports.drafts.create(plan.draft, { fileName: plan.fileName, pdf: plan.pdf })
      return `Saved a draft to ${plan.draft.to}. Nothing was sent.${plan.replace ? ' Delete the earlier draft in Gmail if it is still there.' : ''}`
    case 'register':
      await ports.writeRegister(plan.register!)
      return plan.replace ? 'Changed the invoice’s row on the invoices tab.' : 'Added the invoice to the invoices tab.'
  }
}
