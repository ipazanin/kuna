<script setup lang="ts">
import { useId } from 'vue'

import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'

/** What one try on a loan does, as a bordered box of labelled figures with the try's buttons under them. */
defineProps<{
  /** What a screen reader hears for a box with no title. */
  label?: string
  title?: string
  note?: string
  facts: readonly Fact[]
}>()

const titleId = useId()
</script>

<template>
  <section class="flex flex-col gap-3 rounded-control border border-default p-3" :aria-labelledby="title ? titleId : undefined" :aria-label="title ? undefined : label">
    <div v-if="title || note">
      <h3 v-if="title" :id="titleId" class="type-card-title">{{ title }}</h3>
      <p v-if="note" class="type-caption">{{ note }}</p>
    </div>
    <FactGrid :facts="facts" />
    <slot name="actions" />
  </section>
</template>
