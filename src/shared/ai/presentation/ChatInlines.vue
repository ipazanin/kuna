<script setup lang="ts">
import { computed } from 'vue'

import { formatAccountMoney } from '../../money/moneyFormat'
import type { Money } from '../../money/money'
import type { MoneyFormat } from '../../money/moneyFormat'
import { intlLocale } from '../../text/language'
import MoneyText from '../../ui/MoneyText.vue'
import type { ChatFigure } from '../domain/chatRefs'
import type { ChatInline } from '../domain/chatText'

/**
 * The stretches of a line of a chat. It goes through text interpolation only. A figure ref shows as Kuna's own amount,
 * an account's in the account's currency, or as written when no tool gave it.
 */
const props = defineProps<{
  inlines: readonly ChatInline[]
  figure: (ref: string) => ChatFigure | null
}>()

type Stretch =
  | { readonly kind: 'plain' | 'bold' | 'code'; readonly text: string }
  | { readonly kind: 'app-money'; readonly cents: Money; readonly format: MoneyFormat }
  | { readonly kind: 'account-money'; readonly text: string }

function stretchOf(inline: ChatInline): Stretch {
  if (inline.kind !== 'figure') return { kind: inline.kind, text: inline.text }
  const known = props.figure(inline.text)
  if (known === null) return { kind: 'plain', text: `[${inline.text}]` }
  if (known.of === 'account') return { kind: 'account-money', text: formatAccountMoney(known.cents, known.currency) }
  return { kind: 'app-money', cents: known.cents, format: { currency: known.currency, locale: intlLocale } }
}

const stretches = computed(() => props.inlines.map(stretchOf))
</script>

<template>
  <template v-for="(stretch, at) in stretches" :key="at">
    <strong v-if="stretch.kind === 'bold'" class="font-medium">{{ stretch.text }}</strong>
    <code v-else-if="stretch.kind === 'code'" class="rounded-control bg-elevated px-1 figure">{{ stretch.text }}</code>
    <MoneyText v-else-if="stretch.kind === 'app-money'" :cents="stretch.cents" :format="stretch.format" data-testid="chat-figure" />
    <span v-else-if="stretch.kind === 'account-money'" class="figure whitespace-nowrap" data-testid="chat-figure">{{ stretch.text }}</span>
    <template v-else>{{ stretch.text }}</template>
  </template>
</template>
