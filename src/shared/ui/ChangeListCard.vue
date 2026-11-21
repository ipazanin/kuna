<script lang="ts">
/** One record of a list of changes, as the list shows it. */
export interface ChangeLine {
  readonly key: string
  /** What the record is, such as "2.99%, fixed" or "50%". */
  readonly title: string
  /** When it applies and anything else worth a glance, such as "From 20 Sep 2025". */
  readonly detail: string
  /** What the line's buttons name it by where the title alone does not say which record it is, such as a valuation's date. The title otherwise. */
  readonly label?: string
  /** Set where the record is only removed, so it has Delete in place of Change. */
  readonly removable?: true
}
</script>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { plural } from '../text/translation'
import AppCard from './AppCard.vue'
import { words } from './words'

/** A card of one kind of change to a record, such as a loan's rate periods, each with its Change button, or Delete where it is only removed, and Add in the header. */
withDefaults(
  defineProps<{
    title: string
    subtitle: string
    lines: readonly ChangeLine[]
    /** What the card says with no records. */
    empty: string
    /** The header's Add button, which only a card that can add shows. */
    addLabel?: string
    /** The card's name for this device's memory of whether it is collapsed. */
    collapseId: string
    /** False where the record holds one change at most, such as a loan's subsidy, and has it, or where changes are added elsewhere. */
    canAdd?: boolean
    /** The record whose Delete is being written, which spins. */
    removing?: string | null
  }>(),
  { addLabel: '', canAdd: true, removing: null },
)

const emit = defineEmits<{
  add: []
  change: [key: string]
  remove: [key: string]
}>()
</script>

<template>
  <AppCard :title="title" :subtitle="subtitle" :collapse-id="collapseId" :summary="lines.length === 0 ? empty : plural(words.changeList.onFile(lines.length), lines.length)">
    <template v-if="canAdd" #actions>
      <UButton :label="addLabel" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="change-add" @click="emit('add')" />
    </template>
    <p v-if="lines.length === 0" class="px-4 pt-3 pb-4 type-aside sm:px-5">{{ empty }}</p>
    <ul v-else class="flex flex-col pb-2">
      <li v-for="line in lines" :key="line.key" class="flex items-center gap-3 border-t border-default px-4 py-2 first:border-t-0 sm:px-5" data-testid="change-line">
        <!-- The text grows only to a reading width, so on a wide card each button stays by its line and the buttons line up. -->
        <div class="min-w-0 flex-1 sm:max-w-md">
          <p class="type-row-title">{{ line.title }}</p>
          <p class="type-caption">{{ line.detail }}</p>
        </div>
        <UButton
          v-if="line.removable"
          :label="words.changeList.delete"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          :aria-label="words.changeList.deleteLine(line.label ?? line.title)"
          :loading="removing === line.key"
          data-testid="change-delete"
          @click="emit('remove', line.key)"
        />
        <UButton
          v-else
          :label="words.changeList.change"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          :aria-label="words.changeList.changeLine(line.label ?? line.title)"
          data-testid="change-edit"
          @click="emit('change', line.key)"
        />
      </li>
    </ul>
  </AppCard>
</template>
