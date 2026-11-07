import { reactive } from 'vue'

import { PROVIDER_PRESETS, modelChoice, presetOf } from '../domain/providerPresets'
import type { ModelChoice, ProviderId } from '../domain/providerPresets'

/**
 * This device's choices for the assistant, each under its own key: a switch per app that sends without asking, the
 * provider in use, the model of each provider, and the one AI company Anonymise was switched off for. Every screen reads
 * these choices here and keeps no copy, and a change in another tab arrives here. Absent or denied storage means off and
 * the defaults, and a choice made while storage is denied holds for the visit.
 */
const APP_PREFIX = 'kuna.assist.'
/** Where each task kept its own employee switch, which the one Anonymise switch replaced. */
const RETIRED_TASK_PREFIX = 'kuna.assist-task.'
const PROVIDER_KEY = 'kuna.assist-provider'
const MODEL_PREFIX = 'kuna.assist-model.'
const ANONYMISE_KEY = 'kuna.assist-anonymise'
const ASSIST_KEYS = /^kuna\.assist[.-]/

/** What this visit read or chose, by storage key, so a switch shows its new state at once. */
const choices = reactive<Record<string, string | null>>({})

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null) {
      for (const key of Object.keys(choices)) delete choices[key]
    } else if (ASSIST_KEYS.test(event.key)) {
      choices[event.key] = event.newValue
    }
  })
}

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

/** Whether the app sends to a model without asking. Off until switched on, and while off Kuna asks first. */
export function assistOn(app: string): boolean {
  return choice(`${APP_PREFIX}${app}`) === 'on'
}

/** Switches the app on or off, and off forgets the choice. */
export function switchAssist(app: string, on: boolean): void {
  choose(`${APP_PREFIX}${app}`, on ? 'on' : null)
}

/**
 * Whether Anonymise is on for the AI company: rows about employees and their pay stay on this device, and known people
 * go under an alias. On for every company but the one it was switched off for, whatever storage does.
 */
export function anonymiseOn(provider: ProviderId): boolean {
  return choice(ANONYMISE_KEY) !== provider
}

/** Switches Anonymise for the AI company. Off names the company it holds for, and on forgets the choice. */
export function switchAnonymise(provider: ProviderId, on: boolean): void {
  choose(ANONYMISE_KEY, on ? null : provider)
}

/** The provider picked on this device, or null while none was picked. */
export function pickedProvider(): ProviderId | null {
  const picked = choice(PROVIDER_KEY)
  return PROVIDER_PRESETS.find((preset) => preset.id === picked)?.id ?? null
}

/** Stores the provider already in use as the pick, which moves nothing and takes no yes back. A pick already stored stays, also one another tab has only just made. */
export function pinProvider(id: ProviderId): void {
  if (pickedProvider() === null && read(PROVIDER_KEY) === null) choose(PROVIDER_KEY, id)
}

/**
 * Picks the provider. Anonymise was switched off for one company, so a real change turns it back on. Says whether it did.
 * App switches stay.
 */
export function pickProvider(id: ProviderId): boolean {
  const changed = pickedProvider() !== id
  choose(PROVIDER_KEY, id)
  const wasOff = choice(ANONYMISE_KEY) !== null
  if (changed && wasOff) choose(ANONYMISE_KEY, null)
  return changed && wasOff
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

/** Forgets the app's switch. */
export function forgetAppAssist(app: string): void {
  choose(`${APP_PREFIX}${app}`, null)
}

/** Forgets every choice of the assistant on this device, as one that never made any. */
export function forgetAssistChoices(): void {
  knownNames()
    .filter((key) => ASSIST_KEYS.test(key))
    .forEach((key) => choose(key, null))
}

function knownNames(): readonly string[] {
  return [...new Set([...storedNames(), ...Object.keys(choices)])]
}

function storedNames(): readonly string[] {
  try {
    return Object.keys(localStorage)
  } catch {
    return []
  }
}

/** Clears the employee switch each task once kept, which nothing reads any more. */
function forgetRetiredTaskSwitches(): void {
  storedNames()
    .filter((key) => key.startsWith(RETIRED_TASK_PREFIX))
    .forEach((key) => choose(key, null))
}

forgetRetiredTaskSwitches()

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
