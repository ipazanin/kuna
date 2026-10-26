import { computed, shallowReactive, shallowReadonly } from 'vue'
import type { ComputedRef } from 'vue'

import { currentToken } from '../../../shared/google/googleAuth'
import type { SyncStep } from '../../sync/application/sync'
import type { StepResult } from '../../sync/domain/syncRun'
import { counted } from '../../overview/presentation/waitingForYou'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import { dryRunFor } from '../application/importStatements'
import { fileNewStatements, stillHeld } from '../application/statementSync'
import type { StatementSyncOutcome, StatementSyncStep } from '../application/statementSync'
import type { StatementFolder } from '../application/statementFolder'
import type { DryRunStatement } from '../domain/importDryRun'
import { googleStatementFolder } from '../infrastructure/googleStatementFolder'
import { loadImportFile } from '../infrastructure/importFiles'

interface StatementSyncState {
  /** What the last statements step of this page did, or null before one ran. */
  readonly outcome: StatementSyncOutcome | null
}

const state = shallowReactive<{ -readonly [Field in keyof StatementSyncState]: StatementSyncState[Field] }>({ outcome: null })

async function openStatementFolder(): Promise<StatementFolder> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeStatementFolder } = await import('../infrastructure/fake/fakeStatementFolder')
    return fakeStatementFolder(new URLSearchParams(window.location.search).get('fake'))
  }
  const token = currentToken('drive.readonly')
  if (token === null) {
    throw new Error('The Drive read access ran out. Sync again.')
  }
  return googleStatementFolder(token)
}

function lineOf(step: StatementSyncStep): string {
  return step.kind === 'looking' ? 'Looking for new statements' : `Filing ${step.rows === 1 ? '1 row' : `${step.rows} rows`}`
}

export interface StatementSync {
  readonly state: Readonly<StatementSyncState>
  /** The statements the last sync held, as they stand against the workbook on screen now, or null. */
  readonly held: ComputedRef<readonly DryRunStatement[] | null>
  /** The statements step of a sync: files the new statements of the statements folder in Drive. */
  readonly step: SyncStep
}

/** The statements step of a sync, after the books are read, and what it did, shared by the whole page. A workbook kept in this browser has no sync. */
export function useStatementSync(): StatementSync {
  const store = useWorkbook()

  const held = computed(() => {
    const workbook = store.state.workbook
    const readings = state.outcome?.held ?? []
    if (workbook === null || readings.length === 0) return null
    return dryRunFor(readings, workbook, new Map()).statements.filter(stillHeld)
  })

  /** What the step did, in one line: what it filed with the rows that wait on Review, the notes of each statement, and how many it held. */
  function resultOf(outcome: StatementSyncOutcome): StepResult {
    if (outcome.problem !== null) {
      return { kind: 'failed', line: outcome.problem }
    }
    const receipt = outcome.receipt
    const write = receipt === null ? undefined : store.state.writes.find((written) => written.receipt === receipt)
    const keys = new Set(outcome.filed.flatMap((statement) => statement.rows.filter((row) => row.verdict !== null).map((row) => `${statement.account}|${row.reference}`)))
    const waiting = (store.state.workbook?.transactions ?? []).filter((row) => keys.has(`${row.account}|${row.reference}`) && needsReview(row)).length
    const heldCount = outcome.held.length
    const line = [
      receipt === null ? '' : `${receipt.title}${waiting === 0 ? '' : `, ${waiting} on Review`}.`,
      ...outcome.filed.flatMap((statement) => statement.notes),
      heldCount === 0 ? '' : `${counted(heldCount, '1 statement was', 'statements were')} not filed.`,
    ]
      .filter((sentence) => sentence !== '')
      .join(' ')
    const writeId = write?.id ?? null
    if (heldCount > 0) {
      return { kind: 'waits', line, writeId, link: { label: 'Import', to: '/transactions?tab=import' } }
    }
    return { kind: 'done', line: line || 'Nothing new', writeId, link: waiting > 0 ? { label: 'Review', to: '/review' } : null }
  }

  return {
    state: shallowReadonly(state),
    held,
    step: {
      id: 'statements',
      label: 'Statements',
      scope: 'drive.readonly',
      startLine: lineOf({ kind: 'looking' }),
      on: (workbook) => workbook.settings.statementsSync && workbook.settings.statementsFolder.length > 0,
      async run(report) {
        try {
          state.outcome = await fileNewStatements({ store, folder: await openStatementFolder(), load: loadImportFile, step: (step) => report(lineOf(step)) })
        } catch (failure) {
          state.outcome = null
          throw failure
        }
        return resultOf(state.outcome)
      },
    },
  }
}
