import { createHash } from 'node:crypto'

import type { FiledFile, MailFolders, Mailbox } from '../../src/features/mail/application/mailFiling'
import { MAIL_DATE_PROPERTY, MAIL_SOURCE_PROPERTY } from '../../src/features/mail/domain/mailSource'
import { fold } from '../../src/shared/text/fold'

/** A mail as a test writes it: an ISO time, and each attachment's name with the text its bytes are. */
export interface TestMail {
  readonly id: string
  readonly subject: string
  readonly at: string
  readonly attachments: readonly (readonly [name: string, content: string])[]
}

/** A file a test's folder holds, below the source folder, with the text its bytes are, or null for a file Drive gives no checksum for. */
export interface TestFiled {
  readonly folders: readonly string[]
  readonly name: string
  readonly created: string
  readonly content: string | null
  readonly filedByApp?: boolean
}

export function sha256Of(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * A mailbox that answers a search with the mails whose subject holds its phrase and that came after
 * its window, `pageSize` ids a page, in the order Gmail gives them, newest first. It records the
 * queries and which attachments were downloaded.
 */
export function testMailbox(mails: readonly TestMail[], pageSize = 500): Mailbox & { readonly queries: string[]; readonly downloads: string[] } {
  const queries: string[] = []
  const downloads: string[] = []
  const newestFirst = [...mails].sort((first, second) => Date.parse(second.at) - Date.parse(first.at))
  return {
    queries,
    downloads,
    async search(query, pageToken) {
      queries.push(query)
      const start = pageToken === null ? 0 : Number(pageToken)
      const phrase = fold(/subject:"([^"]*)"/.exec(query)?.[1] ?? '')
      const after = Number(/after:(\d+)/.exec(query)?.[1] ?? 0) * 1000
      const ids = newestFirst.filter((mail) => fold(mail.subject).includes(phrase) && Date.parse(mail.at) > after).map((mail) => mail.id)
      return { ids: ids.slice(start, start + pageSize), next: start + pageSize < ids.length ? String(start + pageSize) : null }
    },
    async message(id) {
      const mail = mails.find((candidate) => candidate.id === id)!
      return { id, subject: mail.subject, date: Date.parse(mail.at), attachments: mail.attachments.map(([name], index) => ({ id: `${id}/${index}`, name })) }
    },
    async attachment(messageId, attachmentId) {
      downloads.push(attachmentId)
      const mail = mails.find((candidate) => candidate.id === messageId)!
      const content = mail.attachments[Number(attachmentId.split('/')[1])]![1]
      return new TextEncoder().encode(content).buffer as ArrayBuffer
    },
  }
}

/** A file the step made: its source folder, the folders below it, its name and properties, and its bytes as text. */
export interface TestCreated {
  readonly folder: readonly string[]
  readonly below: readonly string[]
  readonly name: string
  readonly properties: Readonly<Record<string, string>>
  readonly content: string
}

/**
 * Folders that hold these files below any source folder, and the newest mail the app filed, by
 * source. A file the step makes lands in `created` and is listed from then on, made at `madeAt`,
 * unless `refuse` gives the error its upload fails with.
 */
export function testFolders(
  files: readonly TestFiled[],
  newest: Readonly<Record<string, string>> = {},
  options: { readonly refuse?: (name: string) => Error | null; readonly created?: TestCreated[]; readonly madeAt?: string } = {},
): MailFolders & { readonly asked: (readonly string[])[][]; readonly created: TestCreated[] } {
  const asked: (readonly string[])[][] = []
  const created = options.created ?? []
  return {
    asked,
    created,
    async filesIn(_folder, below) {
      asked.push([...below])
      const wanted = new Set(below.map((folders) => folders.join('/')))
      const listed: FiledFile[] = [
        ...files.map((file) => ({ folders: file.folders, name: file.name, createdTime: Date.parse(file.created), sha256: file.content === null ? null : sha256Of(file.content), filedByApp: file.filedByApp ?? false })),
        ...created.map((file) => ({ folders: file.below, name: file.name, createdTime: Date.parse(options.madeAt ?? '2031-12-31T00:00:00Z'), sha256: sha256Of(file.content), filedByApp: true })),
      ].filter((file) => wanted.has(file.folders.join('/')))
      return { kind: 'listed', files: listed }
    },
    async newestFiled(source) {
      const dates = [newest[source], ...created.filter((file) => file.properties[MAIL_SOURCE_PROPERTY] === source).map((file) => file.properties[MAIL_DATE_PROPERTY])].flatMap((at) => (at === undefined ? [] : [Date.parse(at)]))
      return dates.length === 0 ? null : Math.max(...dates)
    },
    async create(folder, below, file) {
      const refusal = options.refuse?.(file.name) ?? null
      if (refusal !== null) throw refusal
      created.push({ folder, below, name: file.name, properties: file.properties, content: new TextDecoder().decode(file.bytes) })
    },
  }
}

/** The SHA-256 of bytes, as the page works it out. */
export async function hashOf(bytes: ArrayBuffer): Promise<string> {
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex')
}
