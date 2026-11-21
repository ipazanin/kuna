<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { NO_RECIPE_ERRORS } from './recipeErrors'
import type { RecipeErrors } from './recipeErrors'
import TableRecipeEditor from './TableRecipeEditor.vue'
import type { TableRecipeDraft, TableRecipeFields } from '../domain/tableRecipeDraft'
import AppDialog from '../../ui/AppDialog.vue'
import NoteLine from '../../ui/NoteLine.vue'

/**
 * A table recipe in its editor, with Save, and Delete for one the app keeps. The app holds the draft, words what it still
 * lacks as `errors`, and writes it on `save`. The errors show after the first Save.
 */
const props = defineProps<{
  title: string
  description: string
  fields: TableRecipeFields
  fieldLabels: Readonly<Record<string, string>>
  kindLabels: Readonly<Record<string, string>>
  columns: readonly string[] | null
  banks: readonly string[]
  /** What the recipe still lacks, in the app's words, by where it sits. */
  errors: RecipeErrors
  saveLabel: string
  cancelLabel: string
  /** The label of Delete, or null for a recipe the app does not keep yet. */
  deleteLabel: string | null
  saving: boolean
  deleting: boolean
  /** The app takes no changes now. */
  changesRefused: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const draft = defineModel<TableRecipeDraft>('draft', { required: true })
const bank = defineModel<string>('bank', { required: true })
const currency = defineModel<string>('currency', { required: true })

const emit = defineEmits<{ save: []; delete: [] }>()

const tried = ref(false)
watch(open, (opening) => {
  if (opening) tried.value = false
})

const shown = computed(() => (tried.value ? props.errors : NO_RECIPE_ERRORS))
const fine = computed(() => props.errors.across === null && Object.keys(props.errors.fields).length === 0 && Object.keys(props.errors.kinds).length === 0)

function save(): void {
  tried.value = true
  if (fine.value) emit('save')
}
</script>

<template>
  <AppDialog v-model:open="open" changes width="2xl" :title="title" :description="description">
    <form id="recipe-dialog" class="flex flex-col gap-4" data-testid="recipe-dialog" @submit.prevent="save">
      <TableRecipeEditor
        v-model="draft"
        v-model:bank="bank"
        v-model:currency="currency"
        :fields="fields"
        :field-labels="fieldLabels"
        :kind-labels="kindLabels"
        :columns="columns"
        :banks="banks"
        :errors="shown"
      />
      <NoteLine v-if="shown.across !== null" tone="warning" size="body" data-testid="recipe-problem">{{ shown.across }}</NoteLine>
    </form>
    <template #start>
      <UButton
        v-if="deleteLabel !== null"
        :label="deleteLabel"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="deleting"
        :disabled="saving || deleting || changesRefused"
        data-testid="recipe-delete"
        @click="emit('delete')"
      />
    </template>
    <template #end>
      <UButton :label="cancelLabel" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="recipe-dialog" :label="saveLabel" icon="i-lucide-save" :loading="saving" :disabled="saving || deleting || changesRefused" data-testid="recipe-save" />
    </template>
  </AppDialog>
</template>
