<script setup lang="ts">
/** The pair of buttons that moves a row of an ordered list one place up or down, each 44 px square so a thumb reaches it on a phone. */
import UButton from '@nuxt/ui/components/Button.vue'

withDefaults(
  defineProps<{
    /** What the up button is called aloud, such as "Move Groceries up". */
    upLabel: string
    downLabel: string
    first: boolean
    last: boolean
    /** True while the list takes no moves, such as while the file is read-only. */
    disabled?: boolean
    /** The move whose write runs, which shows loading on its button, or null. */
    saving?: 'up' | 'down' | null
    /** What the buttons' test ids start with, such as `spending-rule`, which names them `spending-rule-up` and `spending-rule-down`. */
    testId?: string
  }>(),
  { disabled: false, saving: null, testId: 'move' },
)
const emit = defineEmits<{ up: []; down: [] }>()
</script>

<template>
  <div class="flex shrink-0 items-center">
    <UButton
      icon="i-lucide-arrow-up"
      color="neutral"
      variant="ghost"
      class="size-11 justify-center"
      :aria-label="upLabel"
      :disabled="first || disabled"
      :loading="saving === 'up'"
      :data-testid="`${testId}-up`"
      @click="emit('up')"
    />
    <UButton
      icon="i-lucide-arrow-down"
      color="neutral"
      variant="ghost"
      class="size-11 justify-center"
      :aria-label="downLabel"
      :disabled="last || disabled"
      :loading="saving === 'down'"
      :data-testid="`${testId}-down`"
      @click="emit('down')"
    />
  </div>
</template>
