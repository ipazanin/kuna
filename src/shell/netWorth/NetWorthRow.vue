<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import AppMark from '../../shared/ui/AppMark.vue'
import { words as homeWords } from '../home/words'

/** One line of Net worth beside its app's icon: a figure that opens the screen it comes from, or an app not set up with its Set up button. */
defineProps<{
  icon: string
  colour: `--${string}`
  label: string
  to: RouteLocationRaw
  /** The figure, or null for an app not set up, which shows Set up instead. */
  figure: string | null
  caption?: string | null
}>()
</script>

<template>
  <li class="border-b border-default last:border-b-0">
    <RouterLink v-if="figure !== null" :to="to" class="group flex items-start gap-3 rounded-control py-3">
      <AppMark :icon="icon" :colour="colour" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="type-body text-highlighted decoration-primary underline-offset-3 group-hover:underline">{{ label }}</span>
        <span v-if="caption" class="type-caption">{{ caption }}</span>
      </span>
      <span class="type-body font-semibold text-highlighted tabular-nums">{{ figure }}</span>
    </RouterLink>
    <div v-else class="flex items-center gap-3 py-3 type-body">
      <AppMark :icon="icon" :colour="colour" />
      <span class="min-w-0 flex-1">{{ label }}</span>
      <UButton :to="to" :label="homeWords.setUp" size="sm" color="neutral" variant="outline" />
    </div>
  </li>
</template>
