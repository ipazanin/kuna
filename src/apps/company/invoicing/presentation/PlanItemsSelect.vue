<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { words } from './words'

/** The plan items one line sums, picked from those the plan names and the other lines carry, or typed in. It stays hidden while the plan names no items and the line carries none. */
const items = defineModel<readonly string[]>({ required: true })

const props = defineProps<{
  /** The items the billing plan names for the line's client. */
  planItems: readonly string[]
  /** The items every line of the list carries, so one typed on a line is offered on the others. */
  linesItems: readonly string[]
  label: string
  placeholder: string
  disabled: boolean
  /** What the line's test ids start with: the field takes `-items` after it and each pick `-item`. */
  testId: string
}>()

const created = ref<string[]>([])
const choices = computed(() => [...new Set([...props.planItems, ...props.linesItems, ...created.value])])

function create(text: string): void {
  const typed = text.trim()
  if (typed === '') return
  created.value = [...created.value, typed]
  items.value = [...new Set([...items.value, typed])]
}
</script>

<template>
  <USelectMenu
    v-if="planItems.length > 0 || items.length > 0"
    :model-value="[...items]"
    :items="choices"
    multiple
    create-item
    :search-input="{ placeholder: words.clientLines.searchItem }"
    :aria-label="label"
    :disabled="disabled"
    class="w-full"
    :data-testid="`${testId}-items`"
    @update:model-value="items = ($event as string[]).map(String)"
    @create="create"
  >
    <template #default>
      <span v-if="items.length === 0" class="text-muted">{{ placeholder }}</span>
      <span v-else class="flex min-h-lh min-w-0 flex-wrap items-center gap-1">
        <UBadge v-for="item in items" :key="item" :label="item" color="neutral" variant="subtle" size="xs" class="max-w-full" :data-testid="`${testId}-item`" />
      </span>
    </template>
    <template #empty>{{ words.clientLines.noItems }}</template>
  </USelectMenu>
</template>
