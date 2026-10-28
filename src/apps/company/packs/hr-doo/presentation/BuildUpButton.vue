<script setup lang="ts">
import MoneyText from '../../../../../shared/ui/MoneyText.vue'

/** An amount that opens how it is worked out, set like a drill link but with a dotted underline, since it opens a dialog and not the rows. */
withDefaults(
  defineProps<{
    cents: number
    /** What the amount is, for a screen reader, such as "Benefit in kind in 2026". */
    label: string
    precision?: 'cents' | 'whole'
  }>(),
  { precision: 'cents' },
)

defineEmits<{
  open: []
}>()
</script>

<template>
  <button type="button" class="build-up-button" :aria-label="`${label}, how it is worked out`" data-testid="build-up-button" @click="$emit('open')">
    <MoneyText :cents="cents" :precision="precision" />
  </button>
</template>

<style scoped>
.build-up-button {
  border-radius: 3px;
  color: inherit;
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--border-strong);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition:
    text-decoration-color 120ms ease,
    color 120ms ease;
}

.build-up-button:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}

.build-up-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 639px) {
  .build-up-button {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
  }
}
</style>
