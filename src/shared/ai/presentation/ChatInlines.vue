<script setup lang="ts">
import { computed } from 'vue'

import { formatAccountMoney } from '../../money/moneyFormat'
import type { Money } from '../../money/money'
import type { MoneyFormat } from '../../money/moneyFormat'
import { intlLocale } from '../../text/language'
import MoneyText from '../../ui/MoneyText.vue'
import type { ShownRefs } from '../domain/chatRefs'
import type { ChatInline } from '../domain/chatText'
import { words } from './words'

/**
 * The stretches of a line of a chat. It goes through text interpolation only. A figure ref shows as Kuna's own amount,
 * an account's in the account's currency, and a law ref as the number of the section under the answer. Either shows as
 * written when no tool gave it.
 */
const props = defineProps<{
  inlines: readonly ChatInline[]
  /** What the refs of an answer stand for. A person's own line has none. */
  refs: ShownRefs | null
  /** The law refs the answer cites, in the order its list of sections numbers them. */
  cited: readonly string[]
}>()

type Stretch =
  | { readonly kind: 'plain' | 'bold' | 'code' | 'citation'; readonly text: string }
  | { readonly kind: 'app-money'; readonly cents: Money; readonly format: MoneyFormat }
  | { readonly kind: 'account-money'; readonly text: string }

function stretchOf(inline: ChatInline): Stretch {
  if (inline.kind === 'citation') {
    const number = props.cited.indexOf(inline.text) + 1
    return number === 0 ? { kind: 'plain', text: `[${inline.text}]` } : { kind: 'citation', text: String(number) }
  }
  if (inline.kind !== 'figure') return { kind: inline.kind, text: inline.text }
  const known = props.refs?.figureOf(inline.text) ?? null
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
    <sup v-else-if="stretch.kind === 'citation'" class="text-muted" data-testid="chat-citation-mark"
      ><span aria-hidden="true">{{ stretch.text }}</span
      ><span class="sr-only"> {{ words.answer.source(stretch.text) }}</span></sup
    >
    <template v-else>{{ stretch.text }}</template>
  </template>
</template>
