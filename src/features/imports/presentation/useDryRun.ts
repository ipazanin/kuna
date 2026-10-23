import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { negateMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { typedAmount } from '../../../shared/money/typedAmount'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { dryRunFor } from '../application/importStatements'
import type { ImportDryRun } from '../domain/importDryRun'
import type { StatementReading } from '../domain/importedStatement'

export interface DryRunWithStarts {
  /** Null without a workbook or without statements. */
  readonly dryRun: ComputedRef<ImportDryRun | null>
  /** The accounts the person agreed to start at a statement's opening. */
  readonly started: Readonly<Ref<Readonly<Record<string, boolean>>>>
  /** The openings typed for accounts a file without balances starts. */
  readonly typedOpenings: Readonly<Ref<Readonly<Record<string, string>>>>
  start(account: string, started: boolean): void
  typeOpening(account: string, text: string): void
  /** Forgets the starts and openings, as a newly loaded file does. */
  reset(): void
}

/** An opening as typed, a leading minus for an overdrawn account. */
function openingOf(text: string): Money | null {
  const trimmed = text.trim()
  const amount = typedAmount(trimmed.replace(/^-/, ''))
  return amount === null ? null : trimmed.startsWith('-') ? negateMoney(amount) : amount
}

/** The dry run of the statements against the workbook on screen, with each account the person started at its opening. */
export function useDryRun(readings: Readonly<Ref<readonly StatementReading[]>>): DryRunWithStarts {
  const store = useWorkbook()
  const started = ref<Record<string, boolean>>({})
  const typedOpenings = ref<Record<string, string>>({})

  const dryRun = computed(() => {
    const workbook = store.state.workbook
    if (workbook === null || readings.value.length === 0) return null
    const waiting = dryRunFor(readings.value, workbook, new Map())
    const starts = new Map<string, Money>()
    for (const statement of waiting.statements) {
      const start = statement.start
      if (start === null) continue
      const opening = start.opening === null ? openingOf(typedOpenings.value[start.account] ?? '') : started.value[start.account] ? start.opening : null
      if (opening !== null) starts.set(start.account, opening)
    }
    return starts.size === 0 ? waiting : dryRunFor(readings.value, workbook, starts)
  })

  return {
    dryRun,
    started,
    typedOpenings,
    start(account, agreed) {
      started.value = { ...started.value, [account]: agreed }
    },
    typeOpening(account, text) {
      typedOpenings.value = { ...typedOpenings.value, [account]: text }
    },
    reset() {
      started.value = {}
      typedOpenings.value = {}
    },
  }
}
