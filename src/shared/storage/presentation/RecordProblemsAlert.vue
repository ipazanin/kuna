<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import type { RecordNoun } from '../domain/recordKind'
import type { RecordProblem } from '../domain/recordsRead'
import { words } from './words'

/** The records an app's file holds that its reading leaves out or doubts, one line each, so the person can fix them in the file. */
const props = defineProps<{
  title: string
  problems: readonly (RecordProblem & { readonly noun: RecordNoun })[]
}>()

const lines = computed(() => props.problems.map((problem) => words.recordProblem(problem.noun, problem.label, problem.reason)))
</script>

<template>
  <UAlert icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="title">
    <template #description>
      <ul class="flex flex-col gap-0.5">
        <li v-for="line in lines" :key="line">{{ line }}</li>
      </ul>
    </template>
  </UAlert>
</template>
