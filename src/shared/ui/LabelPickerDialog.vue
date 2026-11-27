<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { labelNameProblem } from '../categorising/domain/labels'
import type { Label } from '../categorising/domain/labels'
import AppDialog from './AppDialog.vue'
import FormGrid from './FormGrid.vue'
import ListRow from './ListRow.vue'
import { words } from './words'
import { useTried } from './useTried'

/** Each label of the books with Put on, or Take off for one every picked row carries, and a new label to add and put on. The screen does the write and closes it. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  title: string
  description: string
  /** Every label of the books, and whether every picked row carries it on all of its parts. */
  choices: readonly { label: Label; onAll: boolean }[]
  /** Whether a write is saving under the key, a label's id or `add`. */
  saving: (key: string) => boolean
  busy: boolean
  /** True while the app takes no changes. */
  changesRefused: boolean
}>()

const emit = defineEmits<{ apply: [label: Label, on: boolean]; add: [name: string] }>()

const name = ref('')
const { tried, markTried } = useTried(open)

watch(open, (opened) => {
  if (!opened) return
  name.value = ''
})

const problem = computed(() =>
  labelNameProblem(
    name.value,
    props.choices.map((choice) => choice.label),
    null,
  ),
)
const error = computed(() => (problem.value === null ? null : words.labelName[problem.value]))

function add(): void {
  markTried()
  if (error.value === null) emit('add', name.value)
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="title" :description="description">
    <div class="flex flex-col gap-4" data-testid="label-picker">
      <ul v-if="choices.length > 0" class="flex flex-col">
        <ListRow v-for="choice in choices" :key="choice.label.id" :title="choice.label.name" flush class="border-t border-default first:border-t-0" data-testid="label-choice">
          <div class="flex">
            <UButton
              :label="choice.onAll ? words.labelPicker.takeOff : words.labelPicker.putOn"
              :icon="choice.onAll ? 'i-lucide-x' : 'i-lucide-tag'"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="saving(choice.label.id)"
              :disabled="busy || changesRefused"
              data-testid="label-apply"
              @click="emit('apply', choice.label, !choice.onAll)"
            />
          </div>
        </ListRow>
      </ul>
      <FormGrid id="label-picker-new" as="form" @submit.prevent="add">
        <UFormField :label="words.labelPicker.newLabel" :error="(tried && error) || false" class="sm:col-span-2">
          <div class="flex gap-2">
            <UInput v-model="name" class="min-w-0 flex-1" data-testid="label-new-name" />
            <UButton type="submit" :label="words.labelPicker.add" icon="i-lucide-plus" :loading="saving('add')" :disabled="busy || changesRefused" data-testid="label-new-add" />
          </div>
        </UFormField>
      </FormGrid>
    </div>
    <template #end>
      <UButton :label="words.labelPicker.cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </AppDialog>
</template>
