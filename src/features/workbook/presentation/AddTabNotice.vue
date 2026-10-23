<script setup lang="ts">
import { computed } from 'vue'

import { templateColumnNames } from '../infrastructure/workbookTemplate'
import type { RowTab } from '../infrastructure/workbookWriter'

/** Says, before a dialog saves, that the write adds the tab to a Google Sheet without one. */
const props = defineProps<{
  tab: RowTab
}>()

const headers = computed(() => templateColumnNames(props.tab).join(', '))
</script>

<template>
  <div class="rounded-[var(--radius-control)] border border-default px-3 py-2 text-sm text-toned" data-testid="add-tab-notice">
    The Sheet has no {{ tab }} tab. Saving adds a tab named <span class="identifier">{{ tab }}</span> with the headers <span class="identifier">{{ headers }}</span> in row 1,
    then writes the rows below them. Nothing else in the Sheet changes.
  </div>
</template>
