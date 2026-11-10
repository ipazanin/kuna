<script lang="ts">
/** One thing the list asks about: the row in the app's words, a line under it, and the choice so far. */
export interface QuestionItem<Value extends string> {
  readonly key: string
  readonly row: string
  readonly caption: string
  readonly choice: Value
  /** Choices of its own, in place of the list's, as when the row it was asked against is gone. */
  readonly options?: readonly { readonly value: Value; readonly label: string }[]
}
</script>

<script setup lang="ts" generic="Value extends string">
import ChoiceButtons from './ChoiceButtons.vue'

/** A list of rows that each ask for one of a few choices, under an optional heading and an intro. */
defineProps<{
  items: readonly QuestionItem<Value>[]
  options: readonly { readonly value: Value; readonly label: string }[]
  /** What each choice is about, read out as its group's name. */
  label: string
  intro: string
  /** Left out inside a card whose title already names the rows. */
  heading?: string
  /** The row whose answer is being written and the choice it took, which shows busy and pressed until the write lands. */
  saving?: { readonly key: string; readonly choice: Value } | null
}>()
const emit = defineEmits<{ answer: [key: string, choice: Value] }>()
</script>

<template>
  <section class="flex flex-col gap-1" data-testid="questions">
    <h3 v-if="heading" class="type-card-title">{{ heading }}</h3>
    <p class="type-caption">{{ intro }}</p>
    <ul class="flex flex-col">
      <li v-for="item in items" :key="item.key" class="flex flex-col gap-1.5 border-t border-default py-3 first:border-t-0" data-testid="question">
        <p class="flex flex-col gap-0.5">
          <span class="break-words type-body text-highlighted">{{ item.row }}</span>
          <span class="break-words type-caption">{{ item.caption }}</span>
        </p>
        <ChoiceButtons
          :model-value="saving?.key === item.key ? saving.choice : item.choice"
          :options="item.options ?? options"
          :label="label"
          :busy="saving?.key === item.key ? saving.choice : null"
          data-testid="question-choice"
          @update:model-value="emit('answer', item.key, $event)"
        />
      </li>
    </ul>
  </section>
</template>
