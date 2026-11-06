<script setup lang="ts">
import AppMark from './AppMark.vue'

/** A name beside its mark: the Kuna mark, or an app's icon on its tile when `icon` and `colour` come with it. */
withDefaults(
  defineProps<{
    title: string
    icon?: string | undefined
    colour?: `--${string}` | undefined
    /** `quiet` is a smaller mark and a muted name, for a link that should not outrank the heading under it. */
    look?: 'standard' | 'quiet'
  }>(),
  { look: 'standard' },
)

const GAP = { standard: 'gap-2.5', quiet: 'gap-2' }
const MARK = { standard: 'size-6', quiet: 'size-5' }
const NAME = { standard: 'type-wordmark', quiet: 'type-label' }
</script>

<template>
  <span class="flex min-w-0 items-center" :class="GAP[look]">
    <AppMark v-if="icon !== undefined && colour !== undefined" :icon="icon" :colour="colour" />
    <svg v-else viewBox="0 0 32 32" class="shrink-0" :class="MARK[look]" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M8 22h16M10 18v-6M16 18V9M22 18v-4" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
    </svg>
    <span class="min-w-0 truncate" :class="NAME[look]">{{ title }}</span>
  </span>
</template>
