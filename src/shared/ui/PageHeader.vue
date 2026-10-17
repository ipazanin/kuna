<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
    <div class="min-w-0">
      <h1 data-testid="screen-title" tabindex="-1" class="screen-title text-title font-semibold text-highlighted">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-[65ch] text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
/* The heading takes focus on arrival so a screen reader announces the screen. It is not a control, so it shows no ring. */
.screen-title:focus {
  outline: none;
}
</style>
