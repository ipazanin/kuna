<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string | null
}>()
</script>

<template>
  <div class="flex items-center gap-2.5">
    <svg viewBox="0 0 32 32" class="size-6 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M8 22h16M10 18v-6M16 18V9M22 18v-4" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
    </svg>
    <span class="flex min-w-0 flex-col">
      <span class="truncate text-[0.9375rem] font-semibold tracking-tight text-highlighted">{{ title }}</span>
      <span v-if="subtitle" class="truncate text-xs text-muted">{{ subtitle }}</span>
    </span>
  </div>
</template>
