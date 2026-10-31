import { computed, shallowReactive, shallowReadonly } from 'vue'
import type { ComputedRef } from 'vue'

import { currentToken } from '../../../../shared/google/googleAuth'
import { folderReadScope } from '../../../../shared/google/googleScopes'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import type { AccessNeed, StepResult } from '../../../../shared/sync/application/syncRun'
import { plural } from '../../../../shared/text/translation'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Workbook } from '../../workbook/domain/workbook'
import { needsReview } from '../../workbook/domain/needsReview'
import { dryRunFor } from '../application/importStatements'
import { fileNewStatements, stillHeld } from '../application/statementSync'
import type { StatementSyncOutcome, StatementSyncStep } from '../application/statementSync'
import type { StatementFolder } from '../application/statementFolder'
import type { DryRunStatement } from '../domain/importDryRun'
import { googleStatementFolder } from '../infrastructure/googleStatementFolder'
import { loadImportFile } from '../infrastructure/importFiles'
import { REVIEW_LINK } from '../../transactions/presentation/transactionsLinks'
import { words } from './words'

interface StatementSyncState {
  /** What the last statements step of this page did, or null before one ran. */
  readonly outcome: StatementSyncOutcome | null
}

const state = shallowReactive<{ -readonly [Field in keyof StatementSyncState]: StatementSyncState[Field] }>({ outcome: null })

/** The statements folder of the books in this file, read with the scope its path needs. */
async function openStatementFolder(workbook: Workbook, booksFileId: string): Promise<StatementFolder> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeStatementFolder } = await import('../infrastructure/fake/fakeStatementFolder')
    return fakeStatementFolder(new URLSearchParams(window.location.search).get('fake'))
  }
  const token = currentToken(folderReadScope(workbook.settings.statementsFolder))
  if (token === null) {
    throw new Error(words.step.accessRanOut)
  }
  return googleStatementFolder(token, booksFileId)
}

const STATEMENTS_LABEL = words.step.label

function isOn(workbook: Workbook): boolean {
  return workbook.settings.statementsSync && workbook.settings.statementsFolder.length > 0
}

/** What the statements step needs of Google for these books, none while their settings turn it off. */
export function statementNeeds(workbook: Workbook): AccessNeed[] {
  return isOn(workbook) ? [{ scope: folderReadScope(workbook.settings.statementsFolder), label: STATEMENTS_LABEL }] : []
}

function lineOf(step: StatementSyncStep): string {
  return step.kind === 'looking' ? words.step.looking : plural(words.step.filing(step.rows), step.rows)
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

  /** What the step did, in one line: what it filed with the rows that wait for review, the notes of each statement, and how many it held. */
  function resultOf(outcome: StatementSyncOutcome): StepResult {
    if (outcome.problem !== null) {
      return { kind: 'failed', line: outcome.problem, link: null }
    }
    const receipt = outcome.receipt
    const write = receipt === null ? undefined : store.state.writes.find((written) => written.receipt === receipt)
    const keys = new Set(outcome.filed.flatMap((statement) => statement.rows.filter((row) => row.verdict !== null).map((row) => `${statement.account}|${row.reference}`)))
    const waiting = (store.state.workbook?.transactions ?? []).filter((row) => keys.has(`${row.account}|${row.reference}`) && needsReview(row)).length
    const heldCount = outcome.held.length
    const line = [
      receipt === null ? '' : words.step.onReview(receipt.title, waiting),
      ...outcome.filed.flatMap((statement) => statement.notes),
      heldCount === 0 ? '' : plural(words.step.held(heldCount), heldCount),
    ]
      .filter((sentence) => sentence !== '')
      .join(' ')
    const writeId = write?.id ?? null
    if (heldCount > 0) {
      return { kind: 'waits', line, writeId, link: { label: words.step.importLink, to: '/company/transactions?tab=import' } }
    }
    return { kind: 'done', line: line || words.step.nothingNew, writeId, link: waiting > 0 ? { label: words.step.reviewLink, to: REVIEW_LINK } : null }
  }

  return {
    state: shallowReadonly(state),
    held,
    step: {
      id: 'statements',
      label: STATEMENTS_LABEL,
      scopes: () => [folderReadScope(store.state.workbook?.settings.statementsFolder ?? [])],
      startLine: lineOf({ kind: 'looking' }),
      on: () => store.state.workbook === null || isOn(store.state.workbook),
      async run(report) {
        const { workbook, choice } = store.state
        if (workbook === null || choice?.source !== 'drive') {
          return { kind: 'done', line: words.step.beforeBooks, writeId: null, link: null }
        }
        try {
          state.outcome = await fileNewStatements({ store, folder: await openStatementFolder(workbook, choice.id), load: loadImportFile, step: (step) => report(lineOf(step)) })
        } catch (failure) {
          state.outcome = null
          throw failure
        }
        return resultOf(state.outcome)
      },
    },
  }
}
