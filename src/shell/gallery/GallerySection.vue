<script setup lang="ts">
/** One part of the gallery under its heading, which the gallery's contents link to by its id. */
defineProps<{
  id: string
  title: string
  /** What the part shows, when the heading alone does not say. */
  description?: string
}>()
</script>

<template>
  <section :id="id" class="flex flex-col gap-4" :aria-labelledby="`${id}-heading`">
    <div>
      <h2 :id="`${id}-heading`" class="text-base font-semibold text-highlighted">{{ title }}</h2>
      <p v-if="description" class="mt-0.5 max-w-[65ch] type-caption">{{ description }}</p>
    </div>
    <slot />
  </section>
</template>
