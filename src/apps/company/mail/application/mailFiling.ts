import { isUnauthorized } from '../../../../shared/google/googleApi'
import type { Workbook } from '../../workbook/domain/workbook'
import { countsLine, filedMailProperties, mailQuery, mailWindow, missingWords, notFiledSentence, windowReaches, yearFolderName } from '../domain/mailSource'
import type { AttachmentNaming, MailAttachment, MailCounts, MailMessage, MailTerms, MailWindow, SourceTerms } from '../domain/mailSource'

/** Gmail still asking the app to slow down after it waited and tried again, which stops the step. */
export class MailRateLimited extends Error {
  constructor() {
    super('Gmail asked us to slow down. Sync again in a minute.')
    this.name = 'MailRateLimited'
  }
}

/** The mailbox, read only. The app never marks, labels or moves a mail. A call Gmail keeps asking to slow down throws `MailRateLimited`. */
export interface Mailbox {
  /** One page of the ids of the mail a search finds, and the token of the next page, or null after the last. */
  search(query: string, pageToken: string | null): Promise<{ readonly ids: readonly string[]; readonly next: string | null }>
  message(id: string): Promise<MailMessage>
  attachment(messageId: string, attachmentId: string): Promise<ArrayBuffer>
}

/** A file already in a source's folder: its folders below the source's folder, when Drive made it in epoch milliseconds, and its SHA-256 when Drive gives one. */
export interface FiledFile {
  readonly folders: readonly string[]
  readonly name: string
  readonly createdTime: number
  readonly sha256: string | null
  /** The date of the mail the app filed it from, as its properties say, or null for a file another app or a person made. */
  readonly filedFrom: number | null
}

export type FolderFiles = { readonly kind: 'listed'; readonly files: readonly FiledFile[] } | { readonly kind: 'refused'; readonly reason: string }

/** A file to make from one attachment: its name, the properties it carries and its bytes. */
export interface MailFile {
  readonly name: string
  readonly properties: Readonly<Record<string, string>>
  readonly bytes: ArrayBuffer
}

/** The Drive folders mail is filed into. The app only adds files there, and never trashes, renames or overwrites one. */
export interface MailFolders {
  /** The files in each of these folders below the folder the path names, and in every folder inside them. A folder not made yet holds none. */
  filesIn(folder: readonly string[], below: readonly (readonly string[])[]): Promise<FolderFiles>
  /** Makes the file in the folders below the folder the path names, making each of those folders that is missing. */
  create(folder: readonly string[], below: readonly string[], file: MailFile): Promise<void>
}

/** What a source names an attachment by: the mail, its bytes when a name needs them, and the books. */
export interface MailReading {
  readonly workbook: Workbook
  bytes(attachment: MailAttachment): Promise<ArrayBuffer>
}

/**
 * One kind of mail the step files, such as the bank's statements, which core or the pack
 * contributes. A redelivery source skips any file of the same name, or of the same redelivery
 * ending. A correction source takes a same-named file from an older mail with other bytes as a
 * correction, as the accountant's resends are.
 */
export interface MailSource {
  readonly id: string
  /** Its name in the step's line and the list, such as Bank statements. */
  readonly label: string
  readonly duplicates: 'redelivery' | 'correction'
  /** Whether the books turn it on, and what they search for and file into. */
  terms(workbook: Workbook): SourceTerms
  /** Where each attachment of one mail goes, or why it matches no rule. */
  name(message: MailMessage, terms: MailTerms, reading: MailReading): Promise<readonly AttachmentNaming[]>
}

/** One mail as the list names it. */
export interface PlannedMail {
  readonly id: string
  readonly subject: string
  readonly date: number
}

/** An attachment a rule named: its mail, its own name, and where it goes. `path` runs from the source's start, My Drive or the folder of the books file, down to the file's folder. */
export interface PlacedAttachment {
  readonly mail: PlannedMail
  readonly attachment: string
  readonly path: readonly string[]
  readonly name: string
}

/**
 * What the step did with one attachment: filed it at its path, failed to upload it, found it
 * already there, found a same-named file from an older mail with other bytes, which is a
 * correction, or with no SHA-256 to compare, or matched it to no rule.
 */
export type PlanEntry =
  | (PlacedAttachment & { readonly kind: 'filed' | 'already' | 'unchecked' | 'correction' })
  | (PlacedAttachment & { readonly kind: 'not-filed'; readonly reason: string })
  | { readonly kind: 'unmatched'; readonly mail: PlannedMail; readonly attachment: string; readonly reason: string }

/** One source's part of the step: what it searched and what it did with each attachment, or why it could not. */
export type SourcePlan =
  | { readonly kind: 'planned'; readonly id: string; readonly label: string; readonly window: MailWindow; readonly query: string; readonly entries: readonly PlanEntry[] }
  | { readonly kind: 'failed'; readonly id: string; readonly label: string; readonly reason: string }

export interface MailPlan {
  readonly sources: readonly SourcePlan[]
}

/** Gmail and the Drive folders, opened only once a source that is on runs. */
export interface MailAccess {
  readonly mailbox: Mailbox
  readonly folders: MailFolders
}

export interface MailFilingPorts {
  open(): Promise<MailAccess>
  readonly sources: readonly MailSource[]
  readonly workbook: Workbook
  /** The start of the day the earliest mail may come, in epoch milliseconds. */
  readonly sinceStart: number
  /** The years from the mail-since day's to this one's, whose folders a source lists before it searches. */
  readonly years: readonly number[]
  hash(bytes: ArrayBuffer): Promise<string>
  /** The step's line while it runs: each source still running with what it does, such as "Bank statements: filing 2 of 3 · VAT returns: searching". */
  report(line: string): void
}

/**
 * How many Gmail calls the step has in flight at once over all its sources, which keeps it well
 * under Gmail's per-user rate. A source also reads and names this many of its mails at once, since
 * more would only wait for a turn.
 */
const GMAIL_AT_ONCE = 10

/**
 * The mail step: the sources that are on run at the same time. Each lists the files of its year
 * folders, searches its window page by page, names every attachment by its rule, and checks the
 * name against what its folder holds and what an earlier mail of this run files. It then makes each
 * new file, oldest mail first. No mail is marked or moved, and no Drive file is trashed, renamed or
 * overwritten. A source that is off makes no call, and one switched on without all it needs fails
 * with what it lacks. A source or an upload that fails leaves the others running, except that mail
 * too new for the next window to reach back to a failed upload waits for it. Google turning the
 * token away or Gmail still asking to slow down stops every source's next call and throws once each
 * source has stopped, so the sync can ask for access or say so, and the next run finds what this one
 * filed in the folder. The plan lists the sources in their order, whichever ends first.
 */
export async function fileMail(ports: MailFilingPorts): Promise<MailPlan> {
  const access = once(async () => sharedAccess(await ports.open()))
  const lines = new Map<string, string>()
  // Only the space after each dot breaks, so a phone wraps the line between sources, never inside one.
  const reportRunning = (): void => {
    if (lines.size > 0) ports.report([...lines.values()].join(' · '))
  }
  const show = (source: MailSource, line: string): void => {
    lines.set(source.id, `${source.label}: ${line}`.replaceAll(' ', ' '))
    reportRunning()
  }
  const settled = await Promise.allSettled(
    ports.sources.map(async (source): Promise<SourcePlan | null> => {
      const terms = source.terms(ports.workbook)
      if (terms.kind === 'off') return null
      if (terms.kind === 'incomplete') {
        return { kind: 'failed', id: source.id, label: source.label, reason: `It is on, but has ${missingWords(terms.missing)} on Settings, General` }
      }
      show(source, 'searching')
      try {
        return await planSource(source, terms.terms, await access(), ports, (line) => show(source, line))
      } catch (failure) {
        if (stopsTheStep(failure)) throw failure
        return { kind: 'failed', id: source.id, label: source.label, reason: failure instanceof Error ? failure.message : String(failure) }
      } finally {
        lines.delete(source.id)
        reportRunning()
      }
    }),
  )
  const stopped = settled.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
  if (stopped !== undefined) throw stopped.reason
  return { sources: settled.flatMap((outcome) => (outcome.status === 'fulfilled' && outcome.value !== null ? [outcome.value] : [])) }
}

/** Google turning the token away or Gmail still asking to slow down, which stops the whole step. */
function stopsTheStep(failure: unknown): boolean {
  return isUnauthorized(failure) || failure instanceof MailRateLimited
}

/**
 * The Gmail and Drive every source of one run shares. A Gmail call waits for one of the step's
 * turns. Once a call stopped the step, every call after it throws that failure without reaching
 * Google, a Gmail call still waiting for its turn among them.
 */
function sharedAccess({ mailbox, folders }: MailAccess): MailAccess {
  const stops: unknown[] = []
  async function unlessStopped<Result>(call: () => Promise<Result>): Promise<Result> {
    if (stops.length > 0) throw stops[0]
    try {
      return await call()
    } catch (failure) {
      if (stopsTheStep(failure)) stops.push(failure)
      throw failure
    }
  }
  const inTurn = turns(GMAIL_AT_ONCE)
  const gmail = <Result>(call: () => Promise<Result>): Promise<Result> => inTurn(() => unlessStopped(call))
  return {
    mailbox: {
      search: (query, pageToken) => gmail(() => mailbox.search(query, pageToken)),
      message: (id) => gmail(() => mailbox.message(id)),
      attachment: (messageId, attachmentId) => gmail(() => mailbox.attachment(messageId, attachmentId)),
    },
    folders: {
      filesIn: (folder, below) => unlessStopped(() => folders.filesIn(folder, below)),
      create: (folder, below, file) => unlessStopped(() => folders.create(folder, below, file)),
    },
  }
}

/** Runs each call once fewer than `count` calls run, in the order they came. */
function turns(count: number): <Result>(call: () => Promise<Result>) => Promise<Result> {
  let free = count
  const waiting: (() => void)[] = []
  return async (call) => {
    if (free > 0) {
      free -= 1
    } else {
      await new Promise<void>((resolve) => waiting.push(resolve))
    }
    try {
      return await call()
    } finally {
      const next = waiting.shift()
      if (next === undefined) {
        free += 1
      } else {
        next()
      }
    }
  }
}

/**
 * The work of each item, at most `count` at once, in the items' order. Once one fails no other
 * starts, and the first failure is thrown after the ones running end.
 */
async function eachAtMost<Item, Result>(items: readonly Item[], count: number, work: (item: Item) => Promise<Result>): Promise<Result[]> {
  const results: Result[] = []
  const failures: unknown[] = []
  let next = 0
  async function worker(): Promise<void> {
    while (failures.length === 0 && next < items.length) {
      const index = next
      next += 1
      try {
        results[index] = await work(items[index]!)
      } catch (failure) {
        failures.push(failure)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, worker))
  if (failures.length > 0) throw failures[0]
  return results
}

/** A file to compare a new name with: one the folder holds, or one an earlier mail of this run files. */
interface Comparable {
  readonly folders: readonly string[]
  readonly name: string
  readonly createdTime: number
  sha256(): Promise<string | null>
}

/**
 * One source's plan. Its year folders from the mail-since year on are listed before the search, so
 * the window starts a week before the newest file there, whoever filed it, and mail found already
 * there moves it as mail the app filed does. A folder of an older year that a mail names is listed
 * after the search. Its mails are read and named at the same time, and its files made one by one.
 */
async function planSource(source: MailSource, terms: MailTerms, { mailbox, folders }: MailAccess, ports: MailFilingPorts, report: (line: string) => void): Promise<SourcePlan> {
  const yearFolders = ports.years.map((year) => yearFolderName(year, terms.folder))
  const listing = await folders.filesIn(
    terms.folder,
    yearFolders.map((name) => [name]),
  )
  if (listing.kind === 'refused') {
    return { kind: 'failed', id: source.id, label: source.label, reason: listing.reason }
  }
  const window = mailWindow(newestOf(listing.files), ports.sinceStart)
  const query = mailQuery(terms, window)
  const byMail = await eachAtMost(await searchAll(mailbox, query), GMAIL_AT_ONCE, async (id) => {
    const message = await mailbox.message(id)
    const downloads = new Map<string, Promise<ArrayBuffer>>()
    const bytes = (attachment: MailAttachment): Promise<ArrayBuffer> => {
      const download = downloads.get(attachment.id) ?? mailbox.attachment(message.id, attachment.id)
      downloads.set(attachment.id, download)
      return download
    }
    const namings = await source.name(message, terms, { workbook: ports.workbook, bytes })
    return { message, namings: namings.map((naming) => ({ message, naming, bytes: () => bytes(naming.attachment) })) }
  })
  const named = byMail.sort((first, second) => first.message.date - second.message.date || first.message.id.localeCompare(second.message.id)).flatMap((mail) => mail.namings)
  const older = uniquePaths(named.flatMap(({ naming }) => (naming.kind === 'named' && !yearFolders.includes(naming.folders[0] ?? '') ? [naming.folders] : [])))
  const olderListing = older.length === 0 ? ({ kind: 'listed', files: [] } as const) : await folders.filesIn(terms.folder, older)
  if (olderListing.kind === 'refused') {
    return { kind: 'failed', id: source.id, label: source.label, reason: olderListing.reason }
  }
  const comparables: Comparable[] = [...listing.files, ...olderListing.files].map((file) => ({ ...file, sha256: async () => file.sha256 }))
  const found: (PlanEntry | ToFile)[] = []
  for (const { message, naming, bytes } of named) {
    const mail = { id: message.id, subject: message.subject, date: message.date }
    if (naming.kind === 'unmatched') {
      found.push({ kind: 'unmatched', mail, attachment: naming.attachment.name, reason: naming.reason })
      continue
    }
    const at: PlacedAttachment = { mail, attachment: naming.attachment.name, path: [...terms.folder, ...naming.folders], name: naming.name }
    const hash = once(async () => ports.hash(await bytes()))
    const filedFromThisMail: Comparable = { folders: naming.folders, name: naming.name, createdTime: message.date, sha256: hash }
    const same = comparables.find((file) => samePath(file.folders, naming.folders) && (file.name === naming.name || (naming.redelivery !== null && file.name.endsWith(naming.redelivery))))
    if (same === undefined) {
      found.push({ kind: 'to-file', at, folders: naming.folders, bytes })
      comparables.push(filedFromThisMail)
      continue
    }
    const sameFile = source.duplicates === 'redelivery' || same.createdTime >= message.date
    const filed = sameFile ? null : await same.sha256()
    if (sameFile) {
      found.push({ kind: 'already', ...at })
    } else if (filed === null) {
      found.push({ kind: 'unchecked', ...at })
    } else if (filed === (await hash())) {
      found.push({ kind: 'already', ...at })
    } else {
      found.push({ kind: 'correction', ...at })
      comparables.splice(comparables.indexOf(same), 1, filedFromThisMail)
    }
  }
  const toFile = found.filter((outcome) => outcome.kind === 'to-file').length
  const entries: PlanEntry[] = []
  let filing = 0
  let firstFailed: PlacedAttachment | null = null
  for (const outcome of found) {
    if (outcome.kind !== 'to-file') {
      entries.push(outcome)
      continue
    }
    filing += 1
    report(`filing ${filing} of ${toFile}`)
    const entry: PlanEntry =
      firstFailed !== null && !windowReaches(firstFailed.mail.date, outcome.at.mail.date)
        ? { kind: 'not-filed', ...outcome.at, reason: `It waits until ${firstFailed.name} is filed, so the next sync still searches back to that mail` }
        : await fileOne(outcome, source, terms, folders)
    if (entry.kind === 'not-filed') firstFailed ??= outcome.at
    entries.push(entry)
  }
  return { kind: 'planned', id: source.id, label: source.label, window, query, entries }
}

/** An attachment new to its folder, before its upload: where it goes, its folders below the source's folder, and its bytes. */
interface ToFile {
  readonly kind: 'to-file'
  readonly at: PlacedAttachment
  readonly folders: readonly string[]
  bytes(): Promise<ArrayBuffer>
}

/** Downloads one attachment and makes its file, or says why it could not, unless the failure stops the step. */
async function fileOne(filing: ToFile, source: MailSource, terms: MailTerms, folders: MailFolders): Promise<PlanEntry> {
  const { at } = filing
  try {
    await folders.create(terms.folder, filing.folders, { name: at.name, properties: filedMailProperties(source.id, at.mail), bytes: await filing.bytes() })
    return { kind: 'filed', ...at }
  } catch (failure) {
    if (stopsTheStep(failure)) throw failure
    return { kind: 'not-filed', ...at, reason: failure instanceof Error ? failure.message : String(failure) }
  }
}

async function searchAll(mailbox: Mailbox, query: string): Promise<string[]> {
  const ids: string[] = []
  let page: string | null = null
  do {
    const found: { readonly ids: readonly string[]; readonly next: string | null } = await mailbox.search(query, page)
    ids.push(...found.ids)
    page = found.next
  } while (page !== null)
  return [...new Set(ids)]
}

/** The newest of the files: the mail's date for one the app filed, and when Drive made it for any other. */
function newestOf(files: readonly FiledFile[]): number | null {
  const dates = files.map((file) => file.filedFrom ?? file.createdTime)
  return dates.length === 0 ? null : Math.max(...dates)
}

/** The call made once, when first asked, and its answer kept. */
function once<Result>(call: () => Promise<Result>): () => Promise<Result> {
  let answer: Promise<Result> | null = null
  return () => (answer ??= call())
}

function samePath(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((name, index) => name === second[index])
}

function uniquePaths(paths: readonly (readonly string[])[]): (readonly string[])[] {
  return [...new Map(paths.map((path) => [JSON.stringify(path), path])).values()]
}

/** What the step did, counted over the entries of every source that ran. */
export function mailCounts(entries: readonly PlanEntry[]): MailCounts {
  const count = (kind: PlanEntry['kind']): number => entries.filter((entry) => entry.kind === kind).length
  return { filed: count('filed'), notFiled: count('not-filed'), already: count('already'), corrections: count('correction'), unchecked: count('unchecked'), unmatched: count('unmatched') }
}

/** The files of a source whose upload failed, named in a sentence, or null when none did. */
export function notFiledLine(entries: readonly PlanEntry[]): string | null {
  const names = entries.flatMap((entry) => (entry.kind === 'not-filed' ? [entry.name] : []))
  return names.length === 0 ? null : notFiledSentence(names)
}

/** Whether a source failed or an upload did, which fails the step. */
export function hasProblem(plan: MailPlan): boolean {
  return plan.sources.some((source) => source.kind === 'failed' || source.entries.some((entry) => entry.kind === 'not-filed'))
}

/**
 * The step's line: the counts over every source that ran, then each source that failed with why,
 * such as "VAT returns: Gmail did not answer.", and each file that was not filed, by source.
 */
export function planLine(plan: MailPlan): string {
  const planned = plan.sources.flatMap((source) => (source.kind === 'planned' ? source.entries : []))
  const problems = plan.sources.flatMap((source) => {
    const problem = source.kind === 'failed' ? source.reason.replace(/\.?$/, '.') : notFiledLine(source.entries)
    return problem === null ? [] : [`${source.label}: ${problem}`]
  })
  const ran = plan.sources.some((source) => source.kind === 'planned')
  return [ran ? `${countsLine(mailCounts(planned))}.` : '', ...problems].filter((sentence) => sentence !== '').join(' ')
}
