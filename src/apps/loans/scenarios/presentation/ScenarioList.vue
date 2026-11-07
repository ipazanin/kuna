<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import ScenarioMark from './ScenarioMark.vue'
import type { ScenarioRow } from './scenariosView'
import { words } from './words'
import type { WriteSaving } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** Every offer kept, compared or not, with its terms, and Edit, Copy and Delete. */
defineProps<{
  title: string
  subtitle: string
  rows: readonly ScenarioRow[]
  saving: WriteSaving
}>()

const emit = defineEmits<{
  edit: [row: ScenarioRow]
  copy: [row: ScenarioRow]
  remove: [row: ScenarioRow]
}>()
</script>

<template>
  <AppCard :title="title" :subtitle="subtitle" data-testid="scenario-list">
    <ul class="flex flex-col px-4 pb-2 sm:px-5">
      <li
        v-for="row in rows"
        :key="row.key"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-default py-2.5 first:border-t-0"
        :data-scenario="row.key"
        data-testid="scenario-row"
      >
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm font-medium text-highlighted">
            <ScenarioMark :letter="row.mark?.letter ?? null" :colour="row.mark?.colour ?? null" />
            <span class="min-w-0">{{ row.name }}</span>
          </p>
          <p class="mt-0.5 type-caption">{{ row.detail }}</p>
        </div>
        <div class="flex gap-0.5">
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" :aria-label="words.list.edit(row.name)" data-testid="scenario-edit" @click="emit('edit', row)" />
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            :aria-label="words.list.copy(row.name)"
            :loading="saving(`copy-${row.key}`)"
            data-testid="scenario-copy"
            @click="emit('copy', row)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            :aria-label="words.list.delete(row.name)"
            :loading="saving(`delete-${row.key}`)"
            data-testid="scenario-delete"
            @click="emit('remove', row)"
          />
        </div>
      </li>
    </ul>
  </AppCard>
</template>
