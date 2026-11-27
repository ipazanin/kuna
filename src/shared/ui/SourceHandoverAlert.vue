<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'

import type { HandoverWords } from './sourceHandover'
import { TONE_ICONS } from './toneText'

/** The warning shown before an account's new source periods are saved, with the rows the save takes out for the new source to bring again. */
defineProps<{
  handover: HandoverWords
}>()
</script>

<template>
  <UAlert color="warning" variant="subtle" :icon="TONE_ICONS.warning" :title="handover.title" class="whitespace-normal">
    <template #description>
      <p v-for="line in handover.days" :key="line">{{ line }}</p>
      <ul v-if="handover.rows.length > 0" class="mt-2 list-disc ps-5">
        <li v-for="line in handover.rows" :key="line">{{ line }}</li>
      </ul>
      <p v-for="line in handover.notes" :key="line" class="mt-2">{{ line }}</p>
    </template>
  </UAlert>
</template>
