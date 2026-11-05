import type { FakeMadeFile } from '../../../../../shared/mail-filing/infrastructure/fake/fakeMail'
import { BOOKS_FOLDER } from '../../../../../shared/text/folderPath'
import { MAIL_STATEMENTS_FOLDER } from '../../../onboarding/domain/statementsChoice'

/** The statements folder onboarding makes beside new books whose statements come from mail, as their `statements_folder` names it. */
export const FAKE_BOOKS_STATEMENTS: readonly string[] = [BOOKS_FOLDER, MAIL_STATEMENTS_FOLDER]

/** The files this page's syncs made in the fake folders, which the fake mail folders and the fake statements folder both list, held until the page reloads. */
export const PAGE_FAKE_MADE_FILES: FakeMadeFile[] = []

/** The variants whose sample statement comes by mail, so the fake statements folder lacks it until a sync files it from the mail. */
const SAMPLE_BY_MAIL = ['mail', 'mail-failed', 'mail-upload-failed', 'mail-switches-off', 'mail-no-sender']

export function sampleStatementByMail(variant: string | null): boolean {
  return variant !== null && SAMPLE_BY_MAIL.includes(variant)
}
