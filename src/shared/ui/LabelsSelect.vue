<script setup lang="ts">
import { computed } from 'vue'
import type { Label } from '../categorising/domain/labels'
import UBadge from '@nuxt/ui/components/Badge.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import type { RecordId } from '../storage/domain/recordId'
import { words } from './words'

/** The labels a part carries, picked from the file's labels and each shown as a badge, with a new label typed into its search added by the caller. */
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
const shown = computed(() => props.labels.filter((label) => picked.value.includes(label.id)))
</script>

<template>
  <USelectMenu
    v-model="chosen"
    :items="items"
    value-key="value"
    multiple
    create-item
    icon="i-lucide-tag"
    :placeholder="words.labels.none"
    :search-input="{ placeholder: words.labels.search }"
    :aria-label="name"
    data-testid="labels-select"
    @create="emit('create', $event)"
  >
    <template #default>
      <span v-if="shown.length === 0" class="text-muted">{{ words.labels.none }}</span>
      <span v-else class="flex min-w-0 flex-wrap gap-1">
        <UBadge v-for="label in shown" :key="label.id" :label="label.name" color="neutral" variant="subtle" size="xs" class="max-w-full" data-testid="labels-pick" />
      </span>
    </template>
  </USelectMenu>
</template>
