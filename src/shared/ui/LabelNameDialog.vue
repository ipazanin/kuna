<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { labelNameProblem } from '../categorising/domain/labels'
import type { Label } from '../categorising/domain/labels'
import AppDialog from './AppDialog.vue'
import FormGrid from './FormGrid.vue'
import { words } from './words'
import { useTried } from './useTried'

/** A label's name, or a new label's, with Delete for one the books hold. The screen does the write and closes it. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The label to change, or null for a new one. */
  label: Label | null
  /** Every label of the books, whose names a new name may not take. */
  labels: readonly Label[]
  /** What Delete takes the label off, or null when nothing carries it. */
  deleteHelp: string | null
  /** Whether a write is saving under the key, `save` or `delete`. */
  saving: (key: string) => boolean
  busy: boolean
  /** True while the app takes no changes. */
  changesRefused: boolean
}>()

const emit = defineEmits<{ save: [name: string]; remove: [] }>()

const name = ref('')
const { tried, markTried } = useTried(open)

watch(open, (opened) => {
  if (!opened) return
  name.value = props.label?.name ?? ''
})

const problem = computed(() => labelNameProblem(name.value, props.labels, props.label?.id ?? null))
const error = computed(() => (problem.value === null ? null : words.labelName[problem.value]))

function save(): void {
  markTried()
  if (error.value === null) emit('save', name.value)
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="label === null ? words.labelDialog.addTitle : words.labelDialog.changeTitle">
    <FormGrid id="label-name-dialog" as="form" data-testid="label-dialog" @submit.prevent="save">
      <UFormField :label="words.labelDialog.name" :error="(tried && error) || false" v-bind="label !== null && deleteHelp !== null ? { help: deleteHelp } : {}" class="sm:col-span-2">
        <UInput v-model="name" class="w-full" data-testid="label-name" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="label !== null"
        :label="words.labelDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="saving('delete')"
        :disabled="busy || changesRefused"
        data-testid="label-delete"
        @click="emit('remove')"
      />
    </template>
    <template #end>
      <UButton :label="words.labelDialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="label-name-dialog"
        :label="label === null ? words.labelDialog.add : words.labelDialog.save"
        :icon="label === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="saving('save')"
        :disabled="busy || changesRefused"
        data-testid="label-save"
      />
    </template>
  </AppDialog>
</template>
