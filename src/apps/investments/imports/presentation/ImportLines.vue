<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ImportLine } from './dryRunLines'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** A group of the dry run, a line per record or row, the first ten until Show all. */
const props = defineProps<{
  lines: readonly ImportLine[]
  /** Whether the note under each line says why it is held back. */
  warns?: boolean
  /** Whether each caption is the file's own text, such as a report's columns, shown as the file writes it. */
  verbatim?: boolean
}>()

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.lines : props.lines.slice(0, FIRST_SHOWN)))
</script>

<template>
  <div class="flex flex-col gap-2">
    <ul class="flex flex-col divide-y divide-default">
      <ProposalRow v-for="line in shown" :key="line.key" :title="line.title" flush data-testid="import-line">
        <template #details>
          <span v-if="line.caption !== ''" class="break-words type-caption" :class="{ identifier: verbatim }">{{ line.caption }}</span>
          <NoteLine v-if="line.note !== '' && warns" as="span" tone="warning">{{ line.note }}</NoteLine>
          <span v-else-if="line.note !== ''" class="break-words type-caption">{{ line.note }}</span>
        </template>
        <template v-if="line.euros !== null || line.figure !== ''" #amount>
          <MoneyText v-if="line.euros !== null" :cents="line.euros" :sign="line.flows ? 'always' : 'magnitude'" :tone="line.flows ? 'flow' : undefined" />
          <span v-if="line.figure !== ''" class="figure" :class="line.euros === null ? 'text-muted' : 'type-caption'">{{ line.figure }}</span>
        </template>
      </ProposalRow>
    </ul>
    <ShowAllButton v-if="lines.length > FIRST_SHOWN" v-model:expanded="expanded" :total="lines.length" />
  </div>
</template>
