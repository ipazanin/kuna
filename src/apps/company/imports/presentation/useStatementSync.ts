import { computed, shallowReactive, shallowReadonly } from 'vue'
import type { ComputedRef } from 'vue'

import type { StepLink, StepResult } from '../../../../shared/sync/application/syncRun'
import { plural } from '../../../../shared/text/translation'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import { dryRunFor } from '../application/importStatements'
import { companyBooksOf } from '../../workbook/domain/readWorkbook'
import { fileNewStatements, stillHeld } from '../application/statementSync'
import type { StatementSyncOutcome, StatementSyncStep } from '../application/statementSync'
import type { DryRunStatement } from '../domain/importDryRun'
import type { StatementReading } from '../domain/importedStatement'
import { REVIEW_LINK } from '../../transactions/presentation/transactionsLinks'
import { words } from './words'
import { factText, noteText } from './dryRunWords'

interface StatementSyncState {
  /** What the last sync of this page did with the statements it read, or null before one did. */
  readonly outcome: StatementSyncOutcome | null
}

const state = shallowReactive<{ -readonly [Field in keyof StatementSyncState]: StatementSyncState[Field] }>({ outcome: null })

function lineOf(step: StatementSyncStep): string {
  return step.kind === 'looking' ? words.step.looking : plural(words.step.filing(step.rows), step.rows)
}

export interface StatementSync {
  readonly state: Readonly<StatementSyncState>
  /** The statements the last sync held, as they stand against the workbook on screen now, or null. */
  readonly held: ComputedRef<readonly DryRunStatement[] | null>
  /** Files the statements a sync read, keeps what it did for the page, and says it as the sync step's result, linked to `link` when nothing waits. */
  file(readings: readonly StatementReading[], report: (line: string) => void, link: StepLink): Promise<StepResult>
  /** Forgets what the last sync did, once a sync stopped before it read the statements. */
  forget(): void
}

/** What the syncs of this page did with the statements they read, shared by the whole page. A workbook kept in this browser has no sync. */
export function useStatementSync(): StatementSync {
  const store = useWorkbook()

  const held = computed(() => {
    const books = companyBooksOf(store.state)
    const readings = state.outcome?.held ?? []
    if (books === null || readings.length === 0) return null
    return dryRunFor(readings, books, new Map(), new Map(), new Map(), true, 'automation').statements.filter(stillHeld)
  })

  /** What filing did, in one line: what it filed with the rows that wait for review, the notes of each statement, and how many it held. */
  function resultOf(outcome: StatementSyncOutcome, link: StepLink): StepResult {
    if (outcome.problem !== null) {
      return { kind: 'failed', line: outcome.problem, link }
    }
    const receipt = outcome.receipt
    const write = receipt === null ? undefined : store.state.writes.find((written) => written.receipt === receipt)
    const keys = new Set(outcome.filed.flatMap((statement) => statement.rows.filter((row) => row.verdict !== null).map((row) => `${statement.account}|${row.reference}`)))
    const waiting = (store.state.workbook?.transactions ?? []).filter((row) => keys.has(`${row.account}|${row.reference}`) && needsReview(row)).length
    const heldCount = outcome.held.length
    const line = [
      receipt === null ? '' : words.step.onReview(receipt.title, waiting),
      ...outcome.filed.flatMap((statement) => [...statement.notes.map(noteText), ...statement.facts.map(factText)]),
      heldCount === 0 ? '' : plural(words.step.held(heldCount), heldCount),
    ]
      .filter((sentence) => sentence !== '')
      .join(' ')
    const writeId = write?.id ?? null
    if (heldCount > 0) {
      return { kind: 'waits', line, writeId, link: { label: words.step.importLink, to: '/company/transactions?tab=import' } }
    }
    return { kind: 'done', line: line || words.step.nothingNew, writeId, link: waiting > 0 ? { label: words.step.reviewLink, to: REVIEW_LINK } : link }
  }

  return {
    state: shallowReadonly(state),
    held,
    async file(readings, report, link) {
      try {
        state.outcome = await fileNewStatements(readings, { store, step: (step) => report(lineOf(step)) })
      } catch (failure) {
        state.outcome = null
        throw failure
      }
      return resultOf(state.outcome, link)
    },
    forget() {
      state.outcome = null
    },
  }
}
