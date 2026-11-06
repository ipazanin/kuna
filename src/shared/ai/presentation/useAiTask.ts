import { computed, onScopeDispose, readonly, shallowRef, watch } from 'vue'
import type { ComputedRef, DeepReadonly, Ref } from 'vue'

import { runTask } from '../application/runTask'
import type { AiTask, TaskResult } from '../domain/aiTask'
import type { AiUsage } from '../domain/modelUsage'
import { assistOn, employeesOn, pickProvider, pickedProvider, pinProvider } from '../infrastructure/assistSettings'
import { keyKept, modelPort } from '../infrastructure/modelAccess'
import { PROVIDER_PRESETS, presetOf } from '../infrastructure/providerPresets'
import type { ProviderId, ProviderPreset } from '../infrastructure/providerPresets'
import { useSecretsChanged } from '../../secrets/presentation/pageSecrets'
import { formatCount, formatMoney } from '../../money/moneyFormat'
import { intlLocale } from '../../text/language'
import { words } from './words'

const secretsChanged = useSecretsChanged()

/** How long one run may take, its rounds together, which also ends a stream that stalls. */
const MOST_RUN_MILLISECONDS = 5 * 60_000

/** The provider this device runs: the one picked, or else the first that has a key kept here. Reactive. */
export function providerInUse(): ProviderPreset | null {
  void secretsChanged.value
  const picked = pickedProvider()
  return picked !== null ? presetOf(picked) : (PROVIDER_PRESETS.find((preset) => keyKept(preset.id)) ?? null)
}

/**
 * Stores the provider in use as the pick. With none stored, a key a sync brought could otherwise move the assistant, and
 * any yes on employee data, to another company without a word.
 */
export function pinProviderInUse(): void {
  const preset = providerInUse()
  if (preset !== null) pinProvider(preset.id)
}

/** Pins the provider in use now and after every change of a key, before a sync or a key saved on a card could move it. The shell calls it once as it starts. */
export function holdProviderInUse(): void {
  pinProviderInUse()
  watch(secretsChanged, pinProviderInUse, { flush: 'sync' })
}

/** A person's act on the select: moves the assistant to the provider, and says whether that took back a yes on employee data. Staying on the provider in use takes none back. */
export function switchProvider(id: ProviderId): boolean {
  pinProviderInUse()
  return pickProvider(id)
}

/** Whether a key is kept here for the provider in use, so an app shows its assist buttons. Reactive. */
export const assistKeyKept: ComputedRef<boolean> = computed(() => {
  const preset = providerInUse()
  return preset !== null && keyKept(preset.id)
})

/** The tasks a person allowed for their next send alone. */
const allowedOnce = new Set<string>()

/** Lets the task's next run send once, whatever its switches say. Every run starts from a tap on its button, which says this first. */
export function allowOnce(taskId: string): void {
  allowedOnce.add(taskId)
}

/** Takes back a yes no run used, as when a tap ended with nothing to send. */
export function forgetOnce(taskId: string): void {
  allowedOnce.delete(taskId)
}

export type AiRunState<Output> = { readonly kind: 'idle' | 'running' } | { readonly kind: 'done'; readonly result: TaskResult<Output> }

export interface AiTaskRun<Input, Output> {
  readonly state: Readonly<Ref<DeepReadonly<AiRunState<Output>>>>
  /** Runs the task on the provider in use. `sendsEmployees` says this input holds employee names or pay. */
  run(input: Input, sendsEmployees?: boolean): Promise<TaskResult<Output>>
  reset(): void
}

/**
 * A task run from a screen, with its state for the screen to show. Nothing is sent with no key kept, or while a switch is
 * off unless the person allowed this one send. A new run, a reset and leaving the screen each abort the run under way, whose result is then dropped.
 */
export function useAiTask<Input, Output>(task: AiTask<Input, Output>): AiTaskRun<Input, Output> {
  const state = shallowRef<AiRunState<Output>>({ kind: 'idle' })
  let current: AbortController | null = null

  function reset(): void {
    current?.abort()
    current = null
    state.value = { kind: 'idle' }
  }
  onScopeDispose(reset, true)

  return {
    state: readonly(state) as AiTaskRun<Input, Output>['state'],
    async run(input, sendsEmployees = false) {
      current?.abort()
      const controller = new AbortController()
      current = controller
      state.value = { kind: 'running' }
      const timeout = setTimeout(() => controller.abort(new Error(words.result.timedOut)), MOST_RUN_MILLISECONDS)
      let result: TaskResult<Output>
      try {
        const once = allowedOnce.delete(task.id)
        const preset = providerInUse()
        result = await runTask(task, input, {
          model: preset === null ? null : await modelPort(task.id, preset),
          appOn: once || assistOn(task.app),
          employees: { sends: sendsEmployees, on: once || employeesOn(task.id) },
          signal: controller.signal,
        })
      } catch (failure) {
        result = { kind: 'failed', reason: failure instanceof Error ? failure.message : String(failure), usage: null }
      } finally {
        clearTimeout(timeout)
      }
      if (current === controller) {
        current = null
        state.value = { kind: 'done', result }
      }
      return result
    },
    reset,
  }
}

/** What a run spent, as "Sonnet 5.5, 812 in, 3,400 from cache, 600 to cache, 1,190 out, about $0.02", or null for a run that spent nothing. */
export function usageLine(result: DeepReadonly<TaskResult<unknown>>): string | null {
  if (!('usage' in result) || result.usage === null) {
    return null
  }
  const usage: DeepReadonly<AiUsage> = result.usage
  const counts = [
    words.usage.input(formatCount(usage.inputTokens)),
    ...(usage.cacheReadTokens > 0 ? [words.usage.cacheRead(formatCount(usage.cacheReadTokens))] : []),
    ...(usage.cacheWriteTokens > 0 ? [words.usage.cacheWrite(formatCount(usage.cacheWriteTokens))] : []),
    words.usage.output(formatCount(usage.outputTokens)),
  ]
  return words.usage.line(usage.model, counts.join(', '), costWords(usage.dollars))
}

function costWords(dollars: number | null): string {
  if (dollars === null) {
    return words.usage.priceUnknown
  }
  const cents = Math.round(dollars * 100)
  const amount = (wholeCents: number): string => formatMoney(wholeCents, 'negative', { currency: 'USD', locale: intlLocale })
  return cents === 0 ? words.usage.underCent(amount(1)) : words.usage.about(amount(cents))
}

/** What a run that gave no draft says, or null for a draft. */
export function resultLine(result: DeepReadonly<TaskResult<unknown>>): string | null {
  switch (result.kind) {
    case 'draft':
      return null
    case 'refused':
      return result.reason === '' ? words.result.declined : words.result.refused(result.reason)
    case 'cut-off':
      return words.result.cutOff
    case 'too-long':
      return words.result.tooLong(formatCount(Number(result.reason)))
    case 'over-budget':
      return words.result.overBudget
    case 'failed':
      return words.result.failed(result.reason)
    case 'holds-secret':
      return words.result.holdsSecret
    case 'no-pdf':
      return words.result.noPdf(providerInUse()?.name ?? '')
    case 'no-key':
      return words.addKey
    case 'switched-off':
      return null
  }
}
