<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { language } from '../../text/language'
import { formatCount } from '../../money/moneyFormat'
import { plural } from '../../text/translation'
import type { SentRead } from '../application/runChatTurn'
import { words } from './words'

/** One read of a chat, closed to a line that says what went, and one tap from the exact text a provider got: aliases, masks and all. */
const props = defineProps<{
  sent: DeepReadonly<SentRead>
}>()

const open = ref(false)

const summary = computed(() => {
  const { read } = props.sent
  if (read.kind === 'figures') return words.sent.figures(read.title, read.app)
  if (read.kind === 'refusal') return words.sent.refusal(read.app)
  const { en, hr } = read.noun
  const noun = language === 'hr' ? plural({ one: hr.one, few: hr.few, other: hr.other }, read.count) : plural({ one: en.one, other: en.many }, read.count)
  return words.sent.records(formatCount(read.count), noun, read.app)
})
</script>

<template>
  <div class="flex min-w-0 flex-col items-start gap-1" data-testid="chat-sent">
    <UButton
      :label="summary"
      :icon="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
      :aria-expanded="open"
      color="neutral"
      variant="ghost"
      size="sm"
      class="-ms-2 text-start"
      :ui="{ label: 'whitespace-normal text-start' }"
      data-testid="chat-sent-toggle"
      @click="open = !open"
    />
    <div v-if="open" class="flex w-full min-w-0 flex-col gap-1">
      <p class="type-caption">{{ words.sent.exact }}</p>
      <pre tabindex="0" class="max-h-64 overflow-y-auto rounded-control bg-elevated p-2 whitespace-pre-wrap wrap-anywhere type-caption" data-testid="chat-sent-text">{{ sent.text }}</pre>
    </div>
  </div>
</template>
