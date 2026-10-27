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

/** The files this page's syncs made in the fake folders, which the fake mail folders and the fake statements folder both list, held until the page reloads. */
export const PAGE_FAKE_MADE_FILES: FakeMadeFile[] = []

/** The variants whose sample statement comes by mail, so the fake statements folder lacks it until a sync files it from the mail. */
const SAMPLE_BY_MAIL = ['mail', 'mail-failed', 'mail-upload-failed']

export function sampleStatementByMail(variant: string | null): boolean {
  return variant !== null && SAMPLE_BY_MAIL.includes(variant)
}
