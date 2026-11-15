<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { words } from './words'
import type { Label } from '../../workbook/domain/label'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The labels a part of an entry carries, picked from the file's labels, with a new label typed into its search added by the caller. */
const props = defineProps<{
  labels: readonly Label[]
  /** What a screen reader calls it, such as the part it labels. */
  name: string
}>()

const picked = defineModel<readonly RecordId[]>({ required: true })

const emit = defineEmits<{ create: [name: string] }>()

const items = computed(() => props.labels.map((label) => ({ label: label.name, value: label.id as string })))
const chosen = computed({
  get: () => [...picked.value] as string[],
  set: (ids: string[]) => {
    picked.value = props.labels.filter((label) => ids.includes(label.id)).map((label) => label.id)
  },
})
const shown = computed(() => props.labels.filter((label) => picked.value.includes(label.id)).map((label) => label.name))
</script>

<template>
  <USelectMenu
    v-model="chosen"
    :items="items"
    value-key="value"
    multiple
    create-item
    icon="i-lucide-tag"
    :placeholder="words.select.none"
    :search-input="{ placeholder: words.select.search }"
    :aria-label="name"
    data-testid="spending-labels-select"
    @create="emit('create', $event)"
  >
    <template #default>
      <span v-if="shown.length === 0" class="text-muted">{{ words.select.none }}</span>
      <span v-else class="min-w-0 truncate">{{ shown.join(', ') }}</span>
    </template>
  </USelectMenu>
</template>
