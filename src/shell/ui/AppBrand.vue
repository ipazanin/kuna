<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="flex items-center gap-2.5">
    <svg viewBox="0 0 32 32" class="size-6 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path d="M8 22h16M10 18v-6M16 18V9M22 18v-4" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
    </svg>
    <span class="min-w-0 truncate text-[0.9375rem] font-semibold tracking-tight text-highlighted">{{ title }}</span>
  </div>
</template>
