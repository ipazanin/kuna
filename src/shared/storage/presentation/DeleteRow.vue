<script setup lang="ts">
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

/** A tick in a delete dialog, whose note says what happens as it stands. A row that goes for good has the error tick, and says so while ticked. */
const ticked = defineModel<boolean>({ required: true })

defineProps<{
  label: string
  goes: string
  stays: string
  /** The first line of a row with no way back. */
  forGood?: string | undefined
  disabled?: boolean
}>()

function tick(on: boolean | 'indeterminate'): void {
  ticked.value = on === true
}
</script>

<template>
  <UCheckbox :model-value="ticked" :label="label" :color="forGood === undefined ? 'primary' : 'error'" :disabled="disabled" @update:model-value="tick">
    <template #description>
      <span v-if="ticked && forGood !== undefined" class="flex items-center gap-1 text-error">
        <UIcon name="i-lucide-triangle-alert" class="shrink-0" />
        {{ forGood }}
      </span>
      {{ ticked ? goes : stays }}
    </template>
  </UCheckbox>
</template>
