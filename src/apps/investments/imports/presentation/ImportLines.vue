<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ImportLine } from './dryRunLines'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** A group of the dry run, a line per record or row, the first ten until Show all. */
const props = defineProps<{
  lines: readonly ImportLine[]
  /** Whether the note under each line says why it is held back. */
  warns?: boolean
}>()

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.lines : props.lines.slice(0, FIRST_SHOWN)))
</script>

<template>
  <div class="flex flex-col gap-2">
    <ul class="flex flex-col">
      <li v-for="line in shown" :key="line.key" class="flex flex-col gap-0.5 border-t border-default py-2.5 first:border-t-0" data-testid="import-line">
        <span class="flex items-baseline justify-between gap-3 type-body">
          <span class="min-w-0 break-words text-highlighted">{{ line.title }}</span>
          <MoneyText v-if="line.euros !== null" :cents="line.euros" :sign="line.flows ? 'always' : 'magnitude'" :tone="line.flows ? 'flow' : undefined" class="shrink-0" />
          <span v-else-if="line.figure !== ''" class="figure shrink-0 text-muted">{{ line.figure }}</span>
        </span>
        <span v-if="line.caption !== '' || (line.euros !== null && line.figure !== '')" class="flex items-baseline justify-between gap-3 type-caption">
          <span class="min-w-0 break-words">{{ line.caption }}</span>
          <span v-if="line.euros !== null && line.figure !== ''" class="shrink-0">{{ line.figure }}</span>
        </span>
        <span v-if="line.note !== ''" class="type-caption break-words" :class="{ 'text-warning': warns }">{{ line.note }}</span>
      </li>
    </ul>
    <ShowAllButton v-if="lines.length > FIRST_SHOWN" v-model:expanded="expanded" :total="lines.length" />
  </div>
</template>
