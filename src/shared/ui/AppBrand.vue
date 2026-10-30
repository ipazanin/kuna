<script setup lang="ts">
import AppMark from './AppMark.vue'

/** A name beside its mark: the Kuna mark, or an app's icon on its tile when `icon` and `colour` come with it. */
withDefaults(
  defineProps<{
    title: string
    icon?: string | undefined
    colour?: `--${string}` | undefined
    /** `quiet` is a smaller mark and a muted name, for a link that should not outrank the heading under it. `lead` is the largest mark with the name centred under it, to open a menu. */
    look?: 'standard' | 'quiet' | 'lead'
  }>(),
  { look: 'standard' },
)

const LAYOUT = { standard: 'items-center gap-2.5', quiet: 'items-center gap-2', lead: 'flex-col items-center gap-1.5' }
const MARK = { standard: 'size-6', quiet: 'size-5', lead: 'size-12' }
const NAME = { standard: 'type-wordmark', quiet: 'type-label', lead: 'type-wordmark' }
</script>

<template>
  <span class="flex min-w-0" :class="LAYOUT[look]">
    <AppMark v-if="icon !== undefined && colour !== undefined" :icon="icon" :colour="colour" />
    <svg v-else viewBox="0 0 32 32" class="shrink-0" :class="MARK[look]" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M8 22h16M10 18v-6M16 18V9M22 18v-4" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
    </svg>
    <span class="min-w-0 truncate" :class="NAME[look]">{{ title }}</span>
  </span>
</template>
