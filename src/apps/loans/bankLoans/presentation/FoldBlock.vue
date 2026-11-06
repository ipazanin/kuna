<script setup lang="ts">
import { useId } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

/** A bordered block of a scenario's editor that folds its fields under a title and a one-line caption. */
const open = defineModel<boolean>('open', { required: true })

withDefaults(
  defineProps<{
    title: string
    caption: string
    /** The caption reads as a warning, such as a change not filled in yet. */
    warning?: boolean
    toggleTestId: string
  }>(),
  { warning: false },
)

const titleId = useId()
const captionId = useId()
</script>

<template>
  <div class="rounded-control border" :class="open ? 'border-accented' : 'border-default'">
    <div class="flex items-center justify-between gap-2 py-2 ps-3 pe-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center justify-between gap-2 text-start"
        :aria-expanded="open"
        :aria-labelledby="titleId"
        :aria-describedby="captionId"
        :data-testid="toggleTestId"
        @click="open = !open"
      >
        <span class="min-w-0">
          <span :id="titleId" class="block type-card-title">{{ title }}</span>
          <span :id="captionId" class="block type-caption" :class="{ 'text-warning': warning }">{{ caption }}</span>
        </span>
        <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
      <slot name="actions" />
    </div>
    <div v-if="open" class="px-3 pt-1 pb-3">
      <slot />
    </div>
  </div>
</template>
