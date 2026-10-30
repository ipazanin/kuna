<script lang="ts">
export interface PickerOption {
  readonly value: string
  /** The name on its toggle. */
  readonly label: string
  /** The name in the base select, when it says more than the toggle, such as with a letter. */
  readonly baseLabel?: string
  /** Always picked, such as the plan every other is compared against. */
  readonly locked?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'

/**
 * Which scenarios sit side by side, up to `most`, as a row of toggles, and which one the others are
 * compared against. Once `most` are picked, the others wait until one is unpicked.
 */
const props = defineProps<{
  options: readonly PickerOption[]
  picked: readonly string[]
  base: string
  most: number
  /** The toggles' accessible name, such as "Scenarios to compare, up to 4". */
  label: string
  /** The words before the base select, such as "Compare against". */
  againstLabel: string
  /** What the row says once `most` are picked. */
  fullNote: string
  /** What a locked toggle tells a screen reader. */
  lockedNote: string
}>()

const emit = defineEmits<{
  toggle: [value: string]
  base: [value: string]
}>()

defineSlots<{
  /** What leads a toggle, such as a scenario's letter and colour. */
  mark?: (scope: { option: PickerOption; picked: boolean }) => unknown
}>()

const full = computed(() => props.picked.length >= props.most)
const waiting = computed(() => full.value && props.options.some((option) => !props.picked.includes(option.value)))
const baseItems = computed(() => props.options.filter((option) => props.picked.includes(option.value)).map((option) => ({ label: option.baseLabel ?? option.label, value: option.value })))

function toggle(option: PickerOption): void {
  if (option.locked !== true) emit('toggle', option.value)
}
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" data-testid="scenario-picker">
    <div class="flex flex-col gap-1.5">
      <div class="flex flex-wrap gap-1.5" role="group" :aria-label="label">
        <UButton
          v-for="option in options"
          :key="option.value"
          color="neutral"
          variant="outline"
          size="sm"
          :class="picked.includes(option.value) ? 'ring-2 ring-inverted' : 'text-toned'"
          :aria-pressed="picked.includes(option.value)"
          :aria-disabled="option.locked === true ? true : undefined"
          :disabled="!picked.includes(option.value) && full"
          :data-option="option.value"
          @click="toggle(option)"
        >
          <slot name="mark" :option="option" :picked="picked.includes(option.value)" />
          {{ option.label }}
          <span v-if="option.locked === true" class="sr-only">, {{ lockedNote }}</span>
        </UButton>
      </div>
      <p v-if="waiting" class="type-caption">{{ fullNote }}</p>
    </div>
    <label v-if="baseItems.length > 1" class="flex items-center gap-2 text-sm text-toned sm:ms-auto">
      <span class="shrink-0">{{ againstLabel }}</span>
      <USelect :model-value="base" :items="baseItems" size="sm" class="min-w-48" data-testid="scenario-base" @update:model-value="emit('base', String($event))" />
    </label>
  </div>
</template>
