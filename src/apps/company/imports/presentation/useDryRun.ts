import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { TwinChoice } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { dryRunFor, newAccountNameProblem } from '../application/importStatements'
import type { CopiedTwinQuestion, ImportDryRun } from '../domain/importDryRun'
import type { StatementReading } from '../domain/importedStatement'

export interface DryRunWithStarts {
  /** Null without a workbook or without statements. */
  readonly dryRun: ComputedRef<ImportDryRun | null>
  /** The accounts the person agreed to start at a statement's opening. */
  readonly started: Readonly<Ref<Readonly<Record<string, boolean>>>>
  /** The openings typed for accounts a file without balances starts. */
  readonly typedOpenings: Readonly<Ref<Readonly<Record<string, string>>>>
  /** The name each new account takes, by its IBAN: as typed, or the one the app suggests. */
  readonly accountNames: ComputedRef<Readonly<Record<string, string>>>
  /** Why a new account's name cannot be used, by its IBAN. */
  readonly accountNameProblems: ComputedRef<Readonly<Record<string, string>>>
  start(account: string, started: boolean): void
  typeOpening(account: string, text: string): void
  nameAccount(iban: string, name: string): void
  answerTwin(question: CopiedTwinQuestion, choice: TwinChoice): void
  /** Forgets the starts, openings, names and answers, as a newly loaded file does. */
  reset(): void
}

/** The name the app suggests for the first new account of a workbook with none named so. */
const SUGGESTED_ACCOUNT = 'main'

/** An opening as typed, a leading minus for an overdrawn account. */
function openingOf(text: string): Money | null {
  const trimmed = text.trim()
  const amount = typedAmount(trimmed.replace(/^-/, ''))
  return amount === null ? null : trimmed.startsWith('-') ? negateMoney(amount) : amount
}

/**
 * The dry run of the statements against the workbook on screen, with each account the person started at its opening, each new
 * account by the name it takes, and what the person said of each entry that looks like a row the AI copied.
 */
export function useDryRun(readings: Readonly<Ref<readonly StatementReading[]>>): DryRunWithStarts {
  const store = useWorkbook()
  const started = ref<Record<string, boolean>>({})
  const typedOpenings = ref<Record<string, string>>({})
  const typedNames = ref<Record<string, string>>({})
  const twinAnswers = ref<Readonly<Record<string, TwinAnswer>>>({})

  /** The IBANs of the new accounts the statements offer, in the order the file gives them. */
  const offered = computed(() => [...new Set(readings.value.flatMap((reading) => ('newAccount' in reading ? [reading.newAccount.iban] : [])))])

  const accountNames = computed(() => {
    const taken = new Set(store.state.workbook?.accounts.map((account) => account.slug) ?? [])
    const names: Record<string, string> = {}
    offered.value.forEach((iban, index) => {
      names[iban] = typedNames.value[iban] ?? (index === 0 && !taken.has(SUGGESTED_ACCOUNT) ? SUGGESTED_ACCOUNT : '')
    })
    return names
  })

  const accountNameProblems = computed(() => {
    const taken = new Set(store.state.workbook?.accounts.map((account) => account.slug) ?? [])
    const problems: Record<string, string> = {}
    for (const [iban, name] of Object.entries(accountNames.value)) {
      const problem = newAccountNameProblem(name, taken)
      if (problem !== null) problems[iban] = problem
      taken.add(name)
    }
    return problems
  })

  const dryRun = computed(() => {
    const workbook = store.state.workbook
    if (workbook === null || readings.value.length === 0) return null
    const names = new Map(Object.entries(accountNames.value))
    const answers = new Map(Object.entries(twinAnswers.value))
    const waiting = dryRunFor(readings.value, workbook, new Map(), names, answers)
    const starts = new Map<string, Money>()
    for (const statement of waiting.statements) {
      const start = statement.start
      if (start === null || statement.newAccount !== null) continue
      const opening = start.opening === null ? openingOf(typedOpenings.value[start.account] ?? '') : started.value[start.account] ? start.opening : null
      if (opening !== null) starts.set(start.account, opening)
    }
    return starts.size === 0 ? waiting : dryRunFor(readings.value, workbook, starts, names, answers)
  })

  return {
    dryRun,
    started,
    typedOpenings,
    accountNames,
    accountNameProblems,
    start(account, agreed) {
      started.value = { ...started.value, [account]: agreed }
    },
    typeOpening(account, text) {
      typedOpenings.value = { ...typedOpenings.value, [account]: text }
    },
    nameAccount(iban, name) {
      typedNames.value = { ...typedNames.value, [iban]: name.trim().toLowerCase() }
    },
    answerTwin(question, choice) {
      const { [question.key]: _answered, ...others } = twinAnswers.value
      twinAnswers.value = choice === 'later' ? others : { ...others, [question.key]: { booked: question.copied.id, keep: choice } }
    },
    reset() {
      started.value = {}
      typedOpenings.value = {}
      typedNames.value = {}
      twinAnswers.value = {}
    },
  }
}
