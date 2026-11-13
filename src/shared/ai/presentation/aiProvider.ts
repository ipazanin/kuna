import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { LoopEnd } from '../application/runModelLoop'
import { anonymiseOn, assistAllowed, carryOverAppYes, pickProvider, pickedProvider, pinProvider } from '../application/assistSettings'
import { keyKept } from '../application/modelAccess'
import { PROVIDER_PRESETS, presetOf } from '../domain/providerPresets'
import type { ProviderId, ProviderPreset } from '../domain/providerPresets'
import { useSecretsChanged } from '../../secrets/presentation/pageSecrets'
import { formatMoney } from '../../money/moneyFormat'
import { intlLocale } from '../../text/language'
import { moneyFromAmount, moneyFromCents, ZERO } from '../../money/money'
import type { Money } from '../../money/money'
import { words } from './words'

const secretsChanged = useSecretsChanged()

/** The provider this device runs: the one picked, or else the first that has a key kept here. Reactive. */
export function providerInUse(): ProviderPreset | null {
  void secretsChanged.value
  const picked = pickedProvider()
  return picked !== null ? presetOf(picked) : (PROVIDER_PRESETS.find((preset) => keyKept(preset.id)) ?? null)
}

/**
 * Stores the provider in use as the pick, and gives it any app's yes from before. With no pick stored, a key a sync brought could
 * otherwise move the assistant, and Anonymise switched off, to another company without a word.
 */
export function pinProviderInUse(): void {
  const preset = providerInUse()
  if (preset === null) return
  pinProvider(preset.id)
  carryOverAppYes(preset.id)
}

/** Pins the provider in use now and after every change of a key, before a sync or a key saved on a card could move it. The shell calls it once as it starts. */
export function holdProviderInUse(): void {
  pinProviderInUse()
  watch(secretsChanged, pinProviderInUse, { flush: 'sync' })
}

/** A person's act on the select: moves the assistant to the provider, and says whether that turned Anonymise back on. Staying on the provider in use changes nothing. */
export function switchProvider(id: ProviderId): boolean {
  pinProviderInUse()
  return pickProvider(id)
}

/** Whether Anonymise is on for the provider in use, so the chat sends known people under an alias. On while no provider is in use. Reactive. */
export function anonymisingNow(): boolean {
  const preset = providerInUse()
  return preset === null || anonymiseOn(preset.id)
}

/** Whether the person said yes for good to the provider in use, so the chat reads and sends in every app without asking. Reactive. */
export function assistAllowedNow(): boolean {
  const preset = providerInUse()
  return preset !== null && assistAllowed(preset.id)
}

/** Whether a key is kept here for the provider in use, so the pages offer the chat. Reactive. */
export const assistKeyKept: ComputedRef<boolean> = computed(() => {
  const preset = providerInUse()
  return preset !== null && keyKept(preset.id)
})

/** What a chat or a file spent, as "about $0.02" or "price unknown". */
export function costWords(dollars: number | null): string {
  if (dollars === null) {
    return words.usage.priceUnknown
  }
  const cost = moneyFromAmount(dollars)
  const amount = (cents: Money): string => formatMoney(cents, 'negative', { currency: 'USD', locale: intlLocale })
  return cost === ZERO ? words.usage.underCent(amount(moneyFromCents(1))) : words.usage.about(amount(cost))
}

/** Why a turn gave no answer, in a sentence, naming the AI company `provider` where the person has to act there. */
export function resultLine(end: Exclude<LoopEnd, { readonly kind: 'answer' }>, provider: string): string {
  switch (end.kind) {
    case 'refused':
      return end.reason === '' ? words.result.declined : words.result.refused(end.reason)
    case 'cut-off':
      return words.result.cutOff
    case 'failed':
      return words.result.failed(end.reason)
    case 'holds-secret':
      return words.result.holdsSecret
    case 'out-of-credit':
      return words.result.outOfCredit(provider)
    case 'key-refused':
      return words.result.keyRefused(provider)
  }
}
