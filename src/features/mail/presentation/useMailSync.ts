import { shallowReactive, shallowReadonly } from 'vue'

import { civilDate, startOfDayIn, today } from '../../../shared/calendar/civilDate'
import { sha256Hex } from '../../../shared/files/sha256'
import { currentToken } from '../../../shared/google/googleAuth'
import { loadImportFile } from '../../imports/infrastructure/importFiles'
import { installedPack, shownPack } from '../../packs/packContribution'
import type { SyncStep } from '../../sync/application/sync'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Workbook } from '../../workbook/domain/workbook'
import { fileMail, hasProblem, planLine } from '../application/mailFiling'
import type { MailFolders, MailPlan, MailSource, Mailbox } from '../application/mailFiling'
import { statementMailSource } from '../application/statementMailSource'
import { gmailMailbox } from '../infrastructure/gmailMailbox'
import { googleMailFolders } from '../infrastructure/googleMailFolders'

/** Where the step's line links, the mail card on Settings, General, which lists what the last run found. */
export const MAIL_LIST_LINK = { label: 'See the list', to: '/settings#mail' } as const

interface MailSyncState {
  /** What the last mail step of this page found and filed, or null before one ran. */
  readonly plan: MailPlan | null
}

const state = shallowReactive<{ plan: MailPlan | null }>({ plan: null })

/** This device's time zone, which the day of a bank's mail and the mail-since day are read in. */
const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const STATEMENTS = statementMailSource(loadImportFile, DEVICE_TIME_ZONE)

/** Core's source, then the pack's while the owner-pay module shows it. */
function sourcesOf(workbook: Workbook): readonly MailSource[] {
  return [STATEMENTS, ...installedPack().mailSources.filter((source) => shownPack(workbook.settings).mailSources.includes(source))]
}

function isOn(workbook: Workbook): boolean {
  return sourcesOf(workbook).some((source) => source.terms(workbook) !== null)
}

async function openMail(): Promise<{ readonly mailbox: Mailbox; readonly folders: MailFolders }> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeMailbox, fakeMailFolders } = await import('../infrastructure/fake/fakeMailbox')
    const variant = new URLSearchParams(window.location.search).get('fake')
    return { mailbox: fakeMailbox(variant), folders: fakeMailFolders(variant) }
  }
  const mail = currentToken('gmail.readonly')
  const drive = currentToken('drive.readonly')
  if (mail === null || drive === null) {
    throw new Error('The Google access ran out. Sync again.')
  }
  return { mailbox: gmailMailbox(mail), folders: googleMailFolders(drive) }
}

export interface MailSync {
  readonly state: Readonly<MailSyncState>
  /** The mail step of a sync, before the statements step, so a statement it files is read by the same sync. */
  readonly step: SyncStep
}

/**
 * The mail step and what it last found, shared by the whole page. It reads Gmail and the folders
 * the mail goes into, and files the bank's statements there. A source or an upload that failed
 * fails the step, with the others' counts in its line.
 */
export function useMailSync(): MailSync {
  const store = useWorkbook()
  return {
    state: shallowReadonly(state),
    step: {
      id: 'mail',
      label: 'Mail',
      scopes: ['gmail.readonly', 'drive.readonly'],
      startLine: 'Searching Gmail',
      on: isOn,
      async run(report) {
        const workbook = store.state.workbook
        if (workbook === null) {
          return { kind: 'done', line: 'Nothing to search before the books are read', writeId: null, link: null }
        }
        const { mailbox, folders } = await openMail()
        const since = workbook.settings.mailSince ?? civilDate(Number(today().slice(0, 4)), 1, 1)
        try {
          state.plan = await fileMail({ mailbox, folders, sources: sourcesOf(workbook), workbook, sinceStart: startOfDayIn(since, DEVICE_TIME_ZONE), hash: sha256Hex, report })
        } catch (failure) {
          state.plan = null
          throw failure
        }
        const line = planLine(state.plan)
        return hasProblem(state.plan) ? { kind: 'failed', line, link: MAIL_LIST_LINK } : { kind: 'done', line, writeId: null, link: MAIL_LIST_LINK }
      },
    },
  }
}
