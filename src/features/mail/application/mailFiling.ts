import { isUnauthorized } from '../../../shared/google/googleApi'
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
  /** Whether the step only lists what it would file for this source, and files nothing. */
  readonly dryRun: boolean
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
 * What the step did with one attachment: filed it at its path, failed to upload it, would file it
 * for a source that only lists, found it already there, found a same-named file from an older mail
 * with other bytes, which is a correction, or with no SHA-256 to compare, or matched it to no rule.
 */
export type PlanEntry =
  | (PlacedAttachment & { readonly kind: 'filed' | 'file' | 'already' | 'unchecked' })
  | (PlacedAttachment & { readonly kind: 'not-filed'; readonly reason: string })
  | (PlacedAttachment & { readonly kind: 'correction'; readonly filedByApp: boolean })
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
  report(line: string): void
}

/** How many mails are read from Gmail at once. */
const READ_AT_ONCE = 5

/**
 * The mail step: each source that is on lists the files of its year folders, searches its window
 * page by page, names every attachment by its rule, and checks the name against what its folder
 * holds and what an earlier mail of this run files. A source that files then makes each new file,
 * oldest mail first, and a dry-run source only lists it. No mail is marked or moved, and no Drive
 * file is trashed, renamed or overwritten. A source that is off makes no call, and one switched on
 * without all it needs fails with what it lacks. A source or an upload that fails leaves the others
 * running, except that mail too new for the next window to reach back to a failed upload waits for
 * it. Google turning the token away or Gmail still asking to slow down throws, so the sync can ask
 * for access or say so, and the next run finds what this one filed in the folder.
 */
export async function fileMail(ports: MailFilingPorts): Promise<MailPlan> {
  const plans: SourcePlan[] = []
  const access = once(ports.open)
  for (const source of ports.sources) {
    const terms = source.terms(ports.workbook)
    if (terms.kind === 'off') continue
    if (terms.kind === 'incomplete') {
      plans.push({ kind: 'failed', id: source.id, label: source.label, reason: `It is on, but has ${missingWords(terms.missing)} on Settings, General` })
      continue
    }
    try {
      ports.report(`${source.label}: searching Gmail`)
      plans.push(await planSource(source, terms.terms, await access(), ports))
    } catch (failure) {
      if (isUnauthorized(failure) || failure instanceof MailRateLimited) throw failure
      plans.push({ kind: 'failed', id: source.id, label: source.label, reason: failure instanceof Error ? failure.message : String(failure) })
    }
  }
  return { sources: plans }
}

/** A file to compare a new name with: one the folder holds, or one an earlier mail of this run would file. */
interface Comparable {
  readonly folders: readonly string[]
  readonly name: string
  readonly createdTime: number
  readonly filedByApp: boolean
  sha256(): Promise<string | null>
}

/**
 * One source's plan. Its year folders from the mail-since year on are listed before the search, so
 * the window starts a week before the newest file there, whoever filed it, and mail found already
 * there moves it as mail the app filed does. A folder of an older year that a mail names is listed
 * after the search.
 */
async function planSource(source: MailSource, terms: MailTerms, { mailbox, folders }: MailAccess, ports: MailFilingPorts): Promise<SourcePlan> {
  const yearFolders = ports.years.map((year) => yearFolderName(year, terms.folder))
  const listing = await folders.filesIn(terms.folder, yearFolders.map((name) => [name]))
  if (listing.kind === 'refused') {
    return { kind: 'failed', id: source.id, label: source.label, reason: listing.reason }
  }
  const window = mailWindow(newestOf(listing.files), ports.sinceStart)
  const query = mailQuery(terms, window)
  const messages = (await readAll(mailbox, await searchAll(mailbox, query))).sort((first, second) => first.date - second.date || first.id.localeCompare(second.id))
  const named: { readonly message: MailMessage; readonly naming: AttachmentNaming; readonly bytes: () => Promise<ArrayBuffer> }[] = []
  for (const message of messages) {
    const downloads = new Map<string, Promise<ArrayBuffer>>()
    const bytes = (attachment: MailAttachment): Promise<ArrayBuffer> => {
      const download = downloads.get(attachment.id) ?? mailbox.attachment(message.id, attachment.id)
      downloads.set(attachment.id, download)
      return download
    }
    const namings = await source.name(message, terms, { workbook: ports.workbook, bytes })
    named.push(...namings.map((naming) => ({ message, naming, bytes: () => bytes(naming.attachment) })))
  }
  const older = uniquePaths(named.flatMap(({ naming }) => (naming.kind === 'named' && !yearFolders.includes(naming.folders[0] ?? '') ? [naming.folders] : [])))
  const olderListing = older.length === 0 ? ({ kind: 'listed', files: [] } as const) : await folders.filesIn(terms.folder, older)
  if (olderListing.kind === 'refused') {
    return { kind: 'failed', id: source.id, label: source.label, reason: olderListing.reason }
  }
  const comparables: Comparable[] = [...listing.files, ...olderListing.files].map((file) => ({ ...file, filedByApp: file.filedFrom !== null, sha256: async () => file.sha256 }))
  const entries: PlanEntry[] = []
  const toFile: ToFile[] = []
  for (const { message, naming, bytes } of named) {
    const mail = { id: message.id, subject: message.subject, date: message.date }
    if (naming.kind === 'unmatched') {
      entries.push({ kind: 'unmatched', mail, attachment: naming.attachment.name, reason: naming.reason })
      continue
    }
    const at: PlacedAttachment = { mail, attachment: naming.attachment.name, path: [...terms.folder, ...naming.folders], name: naming.name }
    const hash = once(async () => ports.hash(await bytes()))
    const filedFromThisMail: Comparable = { folders: naming.folders, name: naming.name, createdTime: message.date, filedByApp: true, sha256: hash }
    const same = comparables.find((file) => samePath(file.folders, naming.folders) && (file.name === naming.name || (naming.redelivery !== null && file.name.endsWith(naming.redelivery))))
    if (same === undefined) {
      toFile.push({ index: entries.length, at, folders: naming.folders, bytes })
      entries.push({ kind: 'file', ...at })
      comparables.push(filedFromThisMail)
      continue
    }
    const sameFile = source.duplicates === 'redelivery' || same.createdTime >= message.date
    const filed = sameFile ? null : await same.sha256()
    if (sameFile) {
      entries.push({ kind: 'already', ...at })
    } else if (filed === null) {
      entries.push({ kind: 'unchecked', ...at })
    } else if (filed === (await hash())) {
      entries.push({ kind: 'already', ...at })
    } else {
      entries.push({ kind: 'correction', ...at, filedByApp: same.filedByApp })
      comparables.splice(comparables.indexOf(same), 1, filedFromThisMail)
    }
  }
  if (!source.dryRun) {
    let firstFailed: PlacedAttachment | null = null
    for (const [count, filing] of toFile.entries()) {
      ports.report(`${source.label}: filing ${count + 1} of ${toFile.length}`)
      const entry: PlanEntry =
        firstFailed !== null && !windowReaches(firstFailed.mail.date, filing.at.mail.date)
          ? { kind: 'not-filed', ...filing.at, reason: `It waits until ${firstFailed.name} is filed, so the next sync still searches back to that mail` }
          : await fileOne(filing, source, terms, folders)
      if (entry.kind === 'not-filed') firstFailed ??= filing.at
      entries[filing.index] = entry
    }
  }
  return { kind: 'planned', id: source.id, label: source.label, window, query, entries }
}

/** An attachment the plan files: its place among the entries, where it goes, its folders below the source's folder, and its bytes. */
interface ToFile {
  readonly index: number
  readonly at: PlacedAttachment
  readonly folders: readonly string[]
  bytes(): Promise<ArrayBuffer>
}

/** Downloads one attachment and makes its file, or says why it could not, unless Google turned the token away. */
async function fileOne(filing: ToFile, source: MailSource, terms: MailTerms, folders: MailFolders): Promise<PlanEntry> {
  const { at } = filing
  try {
    await folders.create(terms.folder, filing.folders, { name: at.name, properties: filedMailProperties(source.id, at.mail), bytes: await filing.bytes() })
    return { kind: 'filed', ...at }
  } catch (failure) {
    if (isUnauthorized(failure)) throw failure
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

async function readAll(mailbox: Mailbox, ids: readonly string[]): Promise<MailMessage[]> {
  const messages: MailMessage[] = []
  for (let start = 0; start < ids.length; start += READ_AT_ONCE) {
    messages.push(...(await Promise.all(ids.slice(start, start + READ_AT_ONCE).map((id) => mailbox.message(id)))))
  }
  return messages
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
  return { filed: count('filed'), file: count('file'), notFiled: count('not-filed'), already: count('already'), corrections: count('correction'), unchecked: count('unchecked'), unmatched: count('unmatched') }
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
