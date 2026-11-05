import { sha256Hex } from '../../../files/sha256'
import { fold } from '../../../text/fold'
import { MailRateLimited } from '../../application/mailFiling'
import type { FiledFile, MailFolders, Mailbox } from '../../application/mailFiling'
import { MAIL_DATE_PROPERTY } from '../../domain/mailSource'
import type { MailMessage } from '../../domain/mailSource'

const PAGE_SIZE = 3

/** One attachment of a fake mail, by the content the seed's `bytesOf` turns into its bytes. */
export interface FakeAttachment {
  readonly name: string
  readonly content: string
}

export interface FakeMail {
  readonly id: string
  readonly subject: string
  /** An ISO time. */
  readonly at: string
  readonly attachments: readonly FakeAttachment[]
  /** Whether `?fake=mail-nothing-new` keeps it, since its files are already in the folders. */
  readonly filed: boolean
}

/** A file the fake folders hold, by its source folder, the folders below it and its name, with the content its bytes come from or no checksum. */
export interface FakeFiled {
  readonly folder: readonly string[]
  readonly folders: readonly string[]
  readonly name: string
  /** An ISO time. */
  readonly created: string
  readonly content: string | null
}

/** A file a sync of the fake build made in one of the fake folders: its source folder, the folders below it, its name, when it was made, its bytes and its properties. */
export interface FakeMadeFile {
  readonly folder: readonly string[]
  readonly folders: readonly string[]
  readonly name: string
  /** An ISO time. */
  readonly created: string
  readonly bytes: ArrayBuffer
  readonly appProperties: Readonly<Record<string, string>>
}

/** What the fake Gmail answers when `?fake=mail-failed` fails a search, in place of the answer Google would send. */
export const FAKE_SEARCH_FAILURE = 'Gmail did not answer the search. Sync again later'

/** What the fake Drive answers when `?fake=mail-upload-failed` fails an upload, in place of the answer Google would send. */
export const FAKE_UPLOAD_FAILURE = 'Drive did not take the upload. Sync again later'

/**
 * A fake Gmail over an app's made-up mail. It answers a search by its subject phrase and its window,
 * three ids a page, so a run reads more than one page. `?fake=mail-failed` fails the search for
 * `failingSearchPhrase`, and `?fake=mail-rate-limited` answers every search as Gmail still asking to
 * slow down after the retries.
 */
export function fakeMailboxOf(seed: { readonly mails: readonly FakeMail[]; readonly failingSearchPhrase: string; bytesOf(content: string): ArrayBuffer }, variant: string | null): Mailbox {
  const mails = seed.mails.filter((mail) => variant !== 'mail-nothing-new' || mail.filed)
  const byId = new Map(mails.map((mail) => [mail.id, mail]))
  return {
    async search(query, pageToken) {
      const phrase = /subject:"([^"]*)"/.exec(query)?.[1] ?? ''
      const after = Number(/after:(\d+)/.exec(query)?.[1] ?? '0') * 1000
      if (variant === 'mail-failed' && phrase === seed.failingSearchPhrase) {
        throw new Error(FAKE_SEARCH_FAILURE)
      }
      if (variant === 'mail-rate-limited') {
        throw new MailRateLimited()
      }
      const found = mails.filter((mail) => fold(mail.subject).includes(fold(phrase)) && Date.parse(mail.at) > after).map((mail) => mail.id)
      const start = pageToken === null ? 0 : Number(pageToken)
      return { ids: found.slice(start, start + PAGE_SIZE), next: start + PAGE_SIZE < found.length ? String(start + PAGE_SIZE) : null }
    },

    async message(id): Promise<MailMessage> {
      const mail = byId.get(id)
      if (mail === undefined) throw new Error(`The fake mailbox holds no mail ${id}.`)
      return { id, subject: mail.subject, date: Date.parse(mail.at), attachments: mail.attachments.map((attachment, index) => ({ id: `${id}-${index}`, name: attachment.name })) }
    },

    async attachment(messageId, attachmentId) {
      const attachment = byId.get(messageId)?.attachments[Number(attachmentId.slice(messageId.length + 1))]
      if (attachment === undefined) throw new Error(`The fake mailbox holds no attachment ${attachmentId}.`)
      return seed.bytesOf(attachment.content)
    },
  }
}

/**
 * Fake folders that hold what another app filed and what a sync made, kept in `made`. `?fake=mail-upload-failed`
 * fails the upload of every PDF, so a statement's PDF fails beside its XML and the accountant's PDFs beside the other files.
 */
export function fakeMailFoldersOf(
  seed: { readonly filed: readonly FakeFiled[]; readonly known: readonly (readonly string[])[]; bytesOf(content: string): ArrayBuffer },
  variant: string | null,
  made: FakeMadeFile[],
): MailFolders {
  const known = seed.known.map((folder) => folder.join('/'))
  return {
    async filesIn(folder, below) {
      const where = folder.join('/')
      if (!known.includes(where)) {
        return { kind: 'refused', reason: `The fake Drive holds no folder at ${where}` }
      }
      const inFolder = (file: { readonly folder: readonly string[]; readonly folders: readonly string[] }): boolean =>
        file.folder.join('/') === where && below.some((path) => path.every((name, index) => file.folders[index] === name))
      const byOthers: Promise<FiledFile>[] = seed.filed.filter(inFolder).map(async (file) => ({
        folders: file.folders,
        name: file.name,
        createdTime: Date.parse(file.created),
        sha256: file.content === null ? null : await sha256Hex(seed.bytesOf(file.content)),
        filedFrom: null,
      }))
      const byApp: Promise<FiledFile>[] = made.filter(inFolder).map(async (file) => ({
        folders: file.folders,
        name: file.name,
        createdTime: Date.parse(file.created),
        sha256: await sha256Hex(file.bytes),
        filedFrom: Date.parse(file.appProperties[MAIL_DATE_PROPERTY] ?? file.created),
      }))
      return { kind: 'listed', files: await Promise.all([...byOthers, ...byApp]) }
    },

    async create(folder, below, file) {
      if (!known.includes(folder.join('/'))) throw new Error(`The fake Drive holds no folder at ${folder.join('/')}`)
      if (variant === 'mail-upload-failed' && file.name.endsWith('.pdf')) throw new Error(FAKE_UPLOAD_FAILURE)
      made.push({ folder, folders: below, name: file.name, created: new Date().toISOString(), bytes: file.bytes, appProperties: file.properties })
    },
  }
}
