<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { words } from './words'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'

/**
 * The camera at the end of an entry's row, which shows while a key is kept, since the chat reads the photo. On a row that
 * cannot take a receipt it keeps its box but is invisible and out of reach, so the amounts of a list stay in one column. On a
 * row that holds a receipt the box shows a receipt mark instead, key or not, and `boxed` keeps the box on the list's other rows.
 */
const props = defineProps<{
  /** The entry's name as the chat's tag holds it, its day and account, never an amount or a payee. */
  label: string
  available: boolean
  /** Whether a receipt is attached to the entry. */
  held?: boolean
  /** Whether the box stays with no key kept, as on a list where a row shows a receipt mark. */
  boxed?: boolean
  testid: string
}>()

const emit = defineEmits<{ take: [] }>()

const takes = computed(() => props.available && assistKeyKept.value)
</script>

<template>
  <span v-if="held" role="img" :aria-label="words.attached" :title="words.attached" class="inline-flex size-7 items-center justify-center text-muted max-sm:size-11" :data-testid="`${testid}-held`">
    <UIcon name="i-lucide-receipt" class="size-4" aria-hidden="true" />
  </span>
  <UButton
    v-else-if="assistKeyKept || boxed"
    v-bind="takes ? { 'aria-label': words.addPhoto(label), title: words.addPhoto(label), 'data-testid': testid } : { 'aria-hidden': true, tabindex: -1 }"
    :class="{ invisible: !takes }"
    icon="i-lucide-camera"
    color="neutral"
    variant="ghost"
    size="sm"
    @click="emit('take')"
  />
</template>
