<script setup lang="ts">
import type { MoneyFormat } from '../../money/moneyFormat'
import { moneyFromCents } from '../../money/money'
import { intlLocale } from '../../text/language'
import MoneyText from '../../ui/MoneyText.vue'
import type { ChatFigure } from '../domain/chatRefs'
import type { ChatInline } from '../domain/chatText'

/** The stretches of a line of a chat. It goes through text interpolation only. A figure ref shows as Kuna's own amount, or as written when no tool gave it. */
const props = defineProps<{
  inlines: readonly ChatInline[]
  figure: (ref: string) => ChatFigure | null
}>()

function formatOf(figure: ChatFigure): MoneyFormat {
  return { currency: figure.currency, locale: intlLocale }
}

const known = (inline: ChatInline): ChatFigure | null => (inline.kind === 'figure' ? props.figure(inline.text) : null)
</script>

<template>
  <template v-for="(inline, at) in inlines" :key="at">
    <strong v-if="inline.kind === 'bold'" class="font-medium">{{ inline.text }}</strong>
    <code v-else-if="inline.kind === 'code'" class="rounded-control bg-elevated px-1 figure">{{ inline.text }}</code>
    <MoneyText v-else-if="known(inline)" :cents="moneyFromCents(known(inline)!.cents)" :format="formatOf(known(inline)!)" data-testid="chat-figure" />
    <template v-else-if="inline.kind === 'figure'">[{{ inline.text }}]</template>
    <template v-else>{{ inline.text }}</template>
  </template>
</template>
