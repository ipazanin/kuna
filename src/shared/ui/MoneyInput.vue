<script setup lang="ts">
import { ref, watch } from 'vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { amountShown, amountTyped, finishedAmount } from '../money/amountTyping'

/**
 * An amount of money typed into a field, grouped as the language on screen writes it while it is typed, with its
 * cents once the field is left. The model is the text shown, which `typedAmount` reads.
 */
const amount = defineModel<string>({ required: true })

const shown = ref(amountShown(amount.value))

watch(amount, (text) => {
  if (text !== shown.value) shown.value = amountShown(text)
})

function show(text: string): void {
  shown.value = text
  amount.value = text
}

function typed(event: Event): void {
  const field = event.target as HTMLInputElement
  const edit = amountTyped(shown.value, field.value, field.selectionStart ?? field.value.length, (event as InputEvent).inputType === 'deleteContentForward')
  // The field is written here, before the input reads it, because a dropped key leaves the model as it was and Vue would not redraw.
  field.value = edit.text
  field.setSelectionRange(edit.caret, edit.caret)
  show(edit.text)
}
</script>

<template>
  <UInput :model-value="shown" inputmode="decimal" @input="typed" @blur="show(finishedAmount(shown))" />
</template>
