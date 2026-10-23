<script setup lang="ts">
import { computed } from 'vue'

import type { RecordKind } from '../domain/recordKind'
import { listInWords } from '../domain/slug'
import { spreadsheetTabOfKind } from '../infrastructure/spreadsheetTab'
import { useMissingColumns } from './missingColumns'

/** Says, before an editor saves, that the save adds the columns its drafts fill and the Google Sheet's tab lacks. */
const props = defineProps<{
  kind: RecordKind<unknown>
  /** The editor's drafts, each field named as its column. */
  drafts: readonly object[]
}>()

const missing = useMissingColumns(props.kind)
const tab = computed(() => spreadsheetTabOfKind(props.kind).tab)
const added = computed(() =>
  missing.value.filter((column) => props.drafts.some((draft) => Object.entries(draft).some(([field, text]) => field === column && typeof text === 'string' && text.trim() !== ''))),
)
</script>

<template>
  <p v-if="added.length > 0" class="rounded-[var(--radius-control)] border border-default px-3 py-2 text-sm text-toned" data-testid="add-column-notice">
    The Sheet's {{ tab }} tab has no {{ listInWords(added) }} {{ added.length === 1 ? 'column' : 'columns' }}. Saving adds
    {{ added.length === 1 ? 'it' : 'them' }} after the last column, with the {{ added.length === 1 ? 'header' : 'headers' }} in row 1, then writes the
    values below. Nothing else in the Sheet changes.
  </p>
</template>
