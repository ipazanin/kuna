import { shallowReactive, shallowReadonly } from 'vue'

import { earliestFrom } from '../../../../shared/app/accountSource'
import { civilDateIn, deviceTimeZone, startOfDayIn } from '../../../../shared/calendar/civilDate'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import { currentToken } from '../../../../shared/google/googleAuth'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import type { Mailbox } from '../../../../shared/mail/application/mailReading'
import { mailWindow } from '../../../../shared/mail/domain/mailSource'
import type { MailSearch } from '../../../../shared/mail/domain/mailSource'
import { gmailMailbox } from '../../../../shared/mail/infrastructure/gmailMailbox'
import type { RecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import type { AccessNeed } from '../../../../shared/sync/application/syncRun'
import { useStatementSync } from '../../imports/presentation/useStatementSync'
import { loadImportFile } from '../../imports/infrastructure/importFiles'
import { setSettings } from '../../settings/application/settingWrites'
import { STATEMENTS_MAIL_KEY, flagText } from '../../settings/domain/settings'
import type { Settings } from '../../settings/domain/settings'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { statementMailReach } from '../../workbook/domain/accountSources'
import type { Workbook } from '../../workbook/domain/workbook'
import { readStatementMail } from '../application/statementMail'
import type { KnownAttachment, StatementMailPlan } from '../application/statementMail'
import { words } from './words'

/** Where the step's line links, the mail card on Settings, General, which lists what the last run found. */
export const MAIL_LIST_LINK = { label: words.step.seeList, to: '/company/settings#mail' } as const

/** Where the step's line links while no account takes the bank's statements, the Accounts tab of Settings. */
export const ACCOUNTS_LINK = { label: words.step.seeAccounts, to: '/company/settings?tab=accounts' } as const

const MAIL_SCOPE: GoogleScope = 'gmail.readonly'

interface MailSyncState {
  /** What the last mail step of this page found, or null before one ran and after one stopped. */
  readonly plan: StatementMailPlan | null
  /** Why the last mail step stopped before it had a plan, or null. A lost access is not named, since only the sync control asks for it. */
  readonly stopped: string | null
}

const state = shallowReactive<{ plan: StatementMailPlan | null; stopped: string | null }>({ plan: null, stopped: null })

/** What this page already read of each attachment. A sync on a timer would otherwise fetch every statement of the window again. */
const known = new Map<string, KnownAttachment>()

/** This device's time zone, which the accounts' days are read in. */
const DEVICE_TIME_ZONE = deviceTimeZone()

/** What the bank's statement mail is searched by, or null while its switch is off or no sender is named, which leaves the mail unread. */
function statementSearch(settings: Settings): MailSearch | null {
  return !settings.statementsMail || settings.statementsMailFrom.length === 0 ? null : { senders: settings.statementsMailFrom, subject: settings.statementsMailSubject }
}

/** Gmail read while the switch is on, a sender is named and some account takes the bank's statements, and nothing otherwise. Before the books are read it counts as needed. */
function mailScopes(workbook: Workbook | null): GoogleScope[] {
  if (workbook === null) return [MAIL_SCOPE]
  return statementSearch(workbook.settings) === null ||
    earliestFrom(
      workbook.accounts.map((account) => account.sources),
      'mail',
    ) === null
    ? []
    : [MAIL_SCOPE]
}

const MAIL_LABEL = words.step.label

/** What the mail step needs of Google for these books, none while their settings turn it off. */
export function mailNeeds(workbook: Workbook): AccessNeed[] {
  return mailScopes(workbook).map((scope) => ({ scope, label: MAIL_LABEL }))
}

async function openMailbox(): Promise<Mailbox> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeMailbox } = await import('../infrastructure/fake/fakeMailbox')
    return fakeMailbox(new URLSearchParams(window.location.search).get('fake'))
  }
  const token = currentToken(MAIL_SCOPE)
  if (token === null) throw new Error(words.step.accessRanOut)
  return gmailMailbox(token)
}

/** What the mail step last found, shared by the whole page. */
export function useMailSync(): { readonly state: Readonly<MailSyncState> } {
  return { state: shallowReadonly(state) }
}

/**
 * The mail step of a sync, which reads the bank's statement mail and files the statements the ledger lacks. It searches Gmail from a week before the day the
 * mail was last read up to, or before a run of days the mail fills that holds no statement yet, reads each statement it finds, and files what is new in one write.
 * Nothing is kept on Drive. Gmail still asking to slow down fails it with that alone. `writes` makes the stop that turns the mail off.
 */
export function statementMailStep(writes: RecordWrites): SyncStep {
  const store = useWorkbook()
  const statements = useStatementSync()

  /** Turns the statement mail off in the books, with Undo, unless it is off already. */
  async function stop(): Promise<void> {
    if (store.state.workbook?.settings.statementsMail !== true) return
    await writes.write(words.step.stoppedTitle, (unit) => setSettings(unit, store.state.records?.settings ?? NO_RECORDS, [{ key: STATEMENTS_MAIL_KEY, value: flagText(false) }]), {
      failedTitle: words.step.notStopped,
      key: 'mail-stop',
    })
  }

  return {
    id: 'mail',
    label: MAIL_LABEL,
    scopes: () => mailScopes(store.state.workbook),
    startLine: words.step.searching,
    on: () => store.state.workbook === null || statementSearch(store.state.workbook.settings) !== null,
    readsMail: { link: MAIL_LIST_LINK, stop },
    async run(report) {
      const { workbook, choice } = store.state
      if (workbook === null || choice?.source !== 'drive') {
        return { kind: 'done', line: words.step.beforeBooks, writeId: null, link: null }
      }
      const search = statementSearch(workbook.settings)
      const since = earliestFrom(
        workbook.accounts.map((account) => account.sources),
        'mail',
      )
      const reach = statementMailReach(workbook.accounts, workbook.transactions, workbook.heldStatements, workbook.settings.statementsMailReadTo)
      if (search === null || since === null || reach === null) {
        state.plan = null
        statements.forget()
        return { kind: 'done', line: words.step.noAccount, writeId: null, link: ACCOUNTS_LINK }
      }
      try {
        state.plan = await readStatementMail({
          mailbox: await openMailbox(),
          search,
          window: mailWindow(startOfDayIn(reach, DEVICE_TIME_ZONE), startOfDayIn(since, DEVICE_TIME_ZONE)),
          workbook,
          load: loadImportFile,
          known,
        })
        state.stopped = null
      } catch (failure) {
        state.plan = null
        state.stopped = isUnauthorized(failure) ? words.step.stopped : failure instanceof Error ? failure.message : String(failure)
        statements.forget()
        throw failure
      }
      const mailed = state.plan.origins.map(({ mailId, mailedAt, attachment, label }) => ({ mailId, mailedOn: civilDateIn(mailedAt, DEVICE_TIME_ZONE), attachment, label }))
      return statements.file(state.plan.readings, mailed, report, MAIL_LIST_LINK)
    },
  }
}
