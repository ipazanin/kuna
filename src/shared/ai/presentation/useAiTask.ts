import { computed, onScopeDispose, readonly, shallowRef } from 'vue'
import type { ComputedRef, DeepReadonly, Ref } from 'vue'

import { runTask } from '../application/runTask'
import type { ModelPort } from '../application/modelPort'
import type { AiTask, AiUsage, TaskResult } from '../domain/aiTask'
import { assistOn, employeesOn, modelOf, pickedProvider } from '../infrastructure/assistSettings'
import { PROVIDER_PRESETS, presetOf } from '../infrastructure/providerPresets'
import type { KeyTest, ProviderPreset } from '../infrastructure/providerPresets'
import { storedSecret } from '../../secrets/infrastructure/browserSecrets'
import { useSecretsChanged } from '../../secrets/presentation/pageSecrets'
import { formatCount, formatMoney } from '../../money/moneyFormat'
import { intlLocale } from '../../text/language'
import { words } from './words'

const secretsChanged = useSecretsChanged()

/** How long one run may take, which leaves room for a large model writing a full answer without streaming. */
const MOST_RUN_MILLISECONDS = 5 * 60_000

/** The provider this device runs: the one picked, or else the first that has a key kept here. Reactive. */
export function providerInUse(): ProviderPreset | null {
  void secretsChanged.value
  const picked = pickedProvider()
  return picked !== null ? presetOf(picked) : (PROVIDER_PRESETS.find((preset) => storedSecret(preset.id) !== null) ?? null)
}

/** Whether a key is kept here for the provider in use, so an app shows its assist buttons. Reactive. */
export const assistKeyKept: ComputedRef<boolean> = computed(() => {
  const preset = providerInUse()
  return preset !== null && storedSecret(preset.id) !== null
})

/** The model port for the provider's key and chosen model, the fake one in the fake build, or null without a key. */
async function modelPort(taskId: string, preset: ProviderPreset): Promise<ModelPort | null> {
  const key = storedSecret(preset.id)
  if (key === null) {
    return null
  }
  const model = modelOf(preset.id)
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeModelPort } = await import('../infrastructure/fake/fakeModel')
    return fakeModelPort(taskId, model)
  }
  if (preset.adapter === 'anthropic-messages') {
    const { anthropicMessages } = await import('../infrastructure/anthropicMessages')
    return anthropicMessages(key, model)
  }
  const { openAiCompatible } = await import('../infrastructure/openAiCompatible')
  return openAiCompatible(preset.baseUrl, key, model, preset.readsPdf, preset.requiresParameters)
}

/** One cheap request with the provider's key that sends nothing from the books. The fake build takes any key. */
export async function testProviderKey(preset: ProviderPreset, key: string): Promise<KeyTest> {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeKeyTest } = await import('../infrastructure/fake/fakeModel')
    return fakeKeyTest()
  }
  if (preset.keyTestUrl === null) {
    const { testAnthropicKey } = await import('../infrastructure/anthropicMessages')
    return testAnthropicKey(key, modelOf(preset.id).id)
  }
  const { testOpenAiCompatibleKey } = await import('../infrastructure/openAiCompatible')
  return testOpenAiCompatibleKey(preset.keyTestUrl, key)
}

export type AiRunState<Output> = { readonly kind: 'idle' | 'running' } | { readonly kind: 'done'; readonly result: TaskResult<Output> }

export interface AiTaskRun<Input, Output> {
  readonly state: Readonly<Ref<DeepReadonly<AiRunState<Output>>>>
  /** Runs the task on the provider in use. `sendsEmployees` says this input holds employee names or pay. */
  run(input: Input, sendsEmployees?: boolean): Promise<TaskResult<Output>>
  reset(): void
}

/**
 * A task run from a screen, with its state for the screen to show. Nothing is sent while a switch is off or no key is
 * kept. A new run, a reset and leaving the screen each abort the run under way, whose result is then dropped.
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
        const preset = providerInUse()
        result = await runTask(task, input, {
          model: preset === null ? null : await modelPort(task.id, preset),
          appOn: assistOn(task.app),
          employees: { sends: sendsEmployees, on: employeesOn(task.id) },
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

/** What a run spent, as "Sonnet 5.5, 4,812 in, 1,190 out, about $0.02", a run under a cent counting as one, or null for a run that spent nothing. */
export function usageLine(result: DeepReadonly<TaskResult<unknown>>): string | null {
  if (!('usage' in result) || result.usage === null) {
    return null
  }
  const usage: DeepReadonly<AiUsage> = result.usage
  const cents = Math.max(1, Math.round(usage.dollars * 100))
  return words.usage(usage.model, formatCount(usage.inputTokens), formatCount(usage.outputTokens), formatMoney(cents, 'negative', { currency: 'USD', locale: intlLocale }))
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
    case 'failed':
      return words.result.failed(result.reason)
    case 'no-pdf':
      return words.result.noPdf(providerInUse()?.name ?? '')
    case 'no-key':
      return words.addKey
    case 'switched-off':
      return null
  }
}
