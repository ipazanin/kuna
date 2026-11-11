<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'

/**
 * The camera at the end of an entry's row, which shows while a key is kept, since the chat reads the photo. On a row that
 * cannot take a receipt it keeps its box but is invisible and out of reach, so the amounts of a list stay in one column.
 */
defineProps<{
  /** The entry's name as the chat's tag holds it, its day and account, never an amount or a payee. */
  label: string
  available: boolean
  testid: string
}>()

const emit = defineEmits<{ take: [] }>()
</script>

<template>
  <UButton
    v-if="assistKeyKept"
    v-bind="available ? { 'aria-label': words.addPhoto(label), title: words.addPhoto(label), 'data-testid': testid } : { 'aria-hidden': true, tabindex: -1 }"
    :class="{ invisible: !available }"
    icon="i-lucide-camera"
    color="neutral"
    variant="ghost"
    size="sm"
    @click="emit('take')"
  />
</template>
