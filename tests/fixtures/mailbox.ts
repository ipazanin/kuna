import { createHash } from 'node:crypto'

import type { FiledFile, MailFolders, Mailbox } from '../../src/features/mail/application/mailFiling'
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
 * A mailbox that answers a search with the mails whose subject holds its phrase, `pageSize` ids a
 * page, in the order Gmail gives them, newest first. It records the queries and which attachments
 * were downloaded.
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
      const ids = newestFirst.filter((mail) => fold(mail.subject).includes(phrase)).map((mail) => mail.id)
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

/** Folders that hold these files below any source folder, and the newest mail the app filed, by source. */
export function testFolders(files: readonly TestFiled[], newest: Readonly<Record<string, string>> = {}): MailFolders & { readonly asked: (readonly string[])[][] } {
  const asked: (readonly string[])[][] = []
  return {
    asked,
    async filesIn(_folder, below) {
      asked.push([...below])
      const wanted = new Set(below.map((folders) => folders.join('/')))
      const listed: FiledFile[] = files
        .filter((file) => wanted.has(file.folders.join('/')))
        .map((file) => ({ folders: file.folders, name: file.name, createdTime: Date.parse(file.created), sha256: file.content === null ? null : sha256Of(file.content), filedByApp: file.filedByApp ?? false }))
      return { kind: 'listed', files: listed }
    },
    async newestFiled(source) {
      const at = newest[source]
      return at === undefined ? null : Date.parse(at)
    },
  }
}

/** The SHA-256 of bytes, as the page works it out. */
export async function hashOf(bytes: ArrayBuffer): Promise<string> {
  return createHash('sha256').update(new Uint8Array(bytes)).digest('hex')
}
