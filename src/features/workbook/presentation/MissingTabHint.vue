<script setup lang="ts">
import { computed } from 'vue'

import { useWorkbook } from '../application/workbookStore'
import type { RecordKind } from '../domain/recordKind'
import { spreadsheetTabOfKind } from '../infrastructure/spreadsheetTab'
import { templateColumnNames } from '../infrastructure/workbookTemplate'

/** Says, under an editor's title, which tab a Google Sheet lacks for the kind and the headers to add, until it has it. */
const props = defineProps<{
  kind: RecordKind<unknown>
}>()

const { state } = useWorkbook()
const tab = computed(() => spreadsheetTabOfKind(props.kind).tab)
const lacks = computed(() => (state.choice?.source ?? state.workbook?.source) === 'google' && (state.snapshot?.meta.missingTabs.includes(tab.value) ?? false))
const headers = computed(() => templateColumnNames(tab.value).join(', '))
</script>

<template>
  <span v-if="lacks" class="mt-2 block text-toned">
    The Sheet has no {{ tab }} tab yet. Add one named {{ tab }} with these headers in row 1, then sync:
    <span class="identifier">{{ headers }}</span>.
  </span>
</template>
