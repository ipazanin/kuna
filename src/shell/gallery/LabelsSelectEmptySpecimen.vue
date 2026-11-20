<script setup lang="ts">
import { ref } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import type { Label } from '../../shared/categorising/domain/labels'
import { recordIdOf } from '../../shared/storage/domain/recordId'
import type { RecordId } from '../../shared/storage/domain/recordId'
import { recordKind } from '../../shared/storage/domain/recordKind'
import LabelsSelect from '../../shared/ui/LabelsSelect.vue'

/** A file with no labels yet, so the open list says a typed name adds one. */
const FIRST_LABELS = recordKind<Label>('gallery-first-label', {
  en: { one: 'label', many: 'labels', article: 'a' },
  hr: { one: 'oznaka', of: 'oznake', few: 'oznake', other: 'oznaka', gender: 'feminine' },
})
const labels = ref<Label[]>([])
const picked = ref<readonly RecordId[]>([])

function added(name: string): void {
  const label = { id: recordIdOf(FIRST_LABELS, String(labels.value.length)), name: name.trim() }
  labels.value = [...labels.value, label]
  picked.value = [...picked.value, label.id]
}
</script>

<template>
  <UFormField label="A file with no labels">
    <LabelsSelect v-model="picked" :labels="labels" name="Labels of the first payment" class="w-full" data-testid="gallery-labels-select-empty" @create="added" />
  </UFormField>
</template>
