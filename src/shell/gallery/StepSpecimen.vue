<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import StepCard, { STEP_FLOW } from '../../shared/ui/StepCard.vue'

/** A two-step first run of its own, so the gallery shows a step card with Back and one without. */
const props = defineProps<{
  start: 'where' | 'folder'
}>()

const step = ref<'where' | 'folder'>(props.start)
provide(STEP_FLOW, { step, canGoBack: computed(() => step.value === 'folder'), back: () => (step.value = 'where') })
</script>

<template>
  <StepCard v-if="step === 'where'" title="Where the file lives">
    <p class="type-body">The first step of a first run has no Back.</p>
    <template #actions>
      <UButton label="Continue" trailing-icon="i-lucide-arrow-right" @click="step = 'folder'" />
    </template>
  </StepCard>
  <StepCard v-else title="Where the file is saved" subtitle="Nothing is made until you confirm the folder.">
    <p class="type-body">A later step has Back at the start of its row of buttons.</p>
    <template #actions>
      <UButton label="Choose folder" icon="i-lucide-folder-open" />
    </template>
  </StepCard>
</template>
