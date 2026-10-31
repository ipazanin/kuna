<script setup lang="ts">
/**
 * Form fields two to a row from 640 px. Each field's label sits in a row of its own, shared across the
 * grid row, so the inputs line up whatever a label's length. Every field takes one column, and one that
 * takes a whole row, such as a field around a switch or a checkbox, says `sm:col-span-2`. Anything that
 * is not a field, such as a bare radio group or a note, takes the whole row.
 */
withDefaults(
  defineProps<{
    as?: 'div' | 'form'
  }>(),
  { as: 'div' },
)
</script>

<template>
  <component :is="as" class="form-grid">
    <slot />
  </component>
</template>

<style scoped>
/*
 * Every part of the form takes two rows of the grid, the label's and the control's. A field lays its
 * label and its control, with the help or error under it, into those rows through subgrid. Any other
 * part takes the whole row, since beside a field its height would push that field's input down. The
 * rows have no gap, as one would fall between a label and its input, so each part keeps its distance
 * from the next with a margin, which the grid gives back at its foot.
 */
.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  column-gap: 1rem;
  margin-block-end: -1rem;
}

.form-grid > :deep(*) {
  grid-row: span 2;
  margin-block-end: 1rem;
}

.form-grid > :deep(:not([data-orientation='vertical']:has(> [data-slot='wrapper']))) {
  grid-column: 1 / -1;
}

.form-grid > :deep([data-orientation='vertical']:has(> [data-slot='wrapper'])) {
  display: grid;
  grid-template-rows: subgrid;
  /* A column that may shrink lets a long choice in a select truncate instead of widening the field past its card. */
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 640px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
