<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section>
    <h1 data-testid="screen-title" class="text-2xl font-semibold text-highlighted">{{ title }}</h1>
    <p class="mt-2 text-muted">Nothing here yet.</p>
  </section>
</template>
