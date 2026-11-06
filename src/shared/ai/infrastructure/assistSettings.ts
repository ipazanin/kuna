import { reactive } from 'vue'

import { PROVIDER_PRESETS, modelChoice, presetOf } from './providerPresets'
import type { ModelChoice, ProviderId } from './providerPresets'

/**
 * This device's choices for the assistant, each under its own key: a switch per app and per task that can send
 * employee data, the provider in use and the model of each provider. Absent or denied storage means off and the
 * defaults, and a choice made while storage is denied holds for the visit.
 */
const APP_PREFIX = 'kuna.assist.'
const TASK_PREFIX = 'kuna.assist-task.'
const PROVIDER_KEY = 'kuna.assist-provider'
const MODEL_PREFIX = 'kuna.assist-model.'

/** What this visit read or chose, by storage key, so a switch shows its new state at once. */
const choices = reactive<Record<string, string | null>>({})

function choice(key: string): string | null {
  if (!Object.hasOwn(choices, key)) {
    choices[key] = read(key)
  }
  return choices[key] ?? null
}

function choose(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage denied: the choice still holds for this visit.
  }
  choices[key] = value
}

/** Whether the app may send anything to a model from this device. Off until switched on. */
export function assistOn(app: string): boolean {
  return choice(`${APP_PREFIX}${app}`) === 'on'
}

/** Switches the app on or off, and off forgets the choice. */
export function switchAssist(app: string, on: boolean): void {
  choose(`${APP_PREFIX}${app}`, on ? 'on' : null)
}

/** Whether the task may send employee names or pay. Off until switched on. */
export function employeesOn(taskId: string): boolean {
  return choice(`${TASK_PREFIX}${taskId}`) === 'on'
}

export function switchEmployees(taskId: string, on: boolean): void {
  choose(`${TASK_PREFIX}${taskId}`, on ? 'on' : null)
}

/** The provider picked on this device, or null while none was picked. */
export function pickedProvider(): ProviderId | null {
  const picked = choice(PROVIDER_KEY)
  return PROVIDER_PRESETS.find((preset) => preset.id === picked)?.id ?? null
}

export function pickProvider(id: ProviderId): void {
  choose(PROVIDER_KEY, id)
}

/** The model this device runs on the provider, its default unless another was picked or typed. */
export function modelOf(id: ProviderId): ModelChoice {
  return modelChoice(presetOf(id), choice(`${MODEL_PREFIX}${id}`))
}

/** Picks a model of the provider by its id, listed or typed by hand. Its default and an empty field forget the choice. */
export function pickModel(id: ProviderId, model: string): void {
  const typed = model.trim()
  choose(`${MODEL_PREFIX}${id}`, typed === '' || typed === presetOf(id).defaultModel ? null : typed)
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
