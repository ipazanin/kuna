<script lang="ts">
/** One record of a loan's changes as its list shows it. */
export interface ChangeLine {
  readonly key: string
  /** What the record is, such as "2.99%, fixed". */
  readonly title: string
  /** When it applies and anything else worth a glance, such as "From 20 Sept 2025". */
  readonly detail: string
}
</script>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'

/** A card of one kind of change to a bank loan, each record with its Change button, and Add in the header. */
withDefaults(
  defineProps<{
    title: string
    subtitle: string
    lines: readonly ChangeLine[]
    /** What the card says with no records. */
    empty: string
    addLabel: string
    /** The card's name for this device's memory of whether it is collapsed. */
    collapseId: string
    /** False where the loan holds one record at most, such as its subsidy, and has it. */
    canAdd?: boolean
  }>(),
  { canAdd: true },
)

const emit = defineEmits<{
  add: []
  change: [key: string]
}>()
</script>

<template>
  <AppCard :title="title" :subtitle="subtitle" :collapse-id="collapseId" :summary="lines.length === 0 ? empty : `${lines.length} on file`">
    <template v-if="canAdd" #actions>
      <UButton :label="addLabel" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="change-add" @click="emit('add')" />
    </template>
    <p v-if="lines.length === 0" class="px-4 pb-4 text-sm text-muted sm:px-5">{{ empty }}</p>
    <ul v-else class="flex flex-col pb-2">
      <li v-for="line in lines" :key="line.key" class="flex items-center justify-between gap-3 border-t border-default px-4 py-2 first:border-t-0 sm:px-5" data-testid="change-line">
        <div class="min-w-0">
          <p class="text-sm text-highlighted">{{ line.title }}</p>
          <p class="text-xs text-muted">{{ line.detail }}</p>
        </div>
        <UButton
          label="Change"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          :aria-label="`Change ${line.title}`"
          data-testid="change-edit"
          @click="emit('change', line.key)"
        />
      </li>
    </ul>
  </AppCard>
</template>
