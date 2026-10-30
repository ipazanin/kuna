<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { ScenarioDraft } from './ScenarioEditor.vue'
import { words } from './words'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import { words as loansWords } from '../../words'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import AppDialog from '../../../../shared/ui/AppDialog.vue'

/** Where a new scenario starts: a bank loan as it stands, or blank as an offer you are weighing. Next opens the editor. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The bank loans a scenario can change, those whose plan Kuna can work out. */
  loans: readonly BankLoan[]
  /** The loan picked first, or null to start blank. */
  startLoan: RecordId | null
}>()

const emit = defineEmits<{
  next: [draft: ScenarioDraft]
}>()

const start = ref<'loan' | 'offer'>('loan')
const loan = ref('')
const name = ref('')
const tried = ref(false)

const starts = computed(() => [
  { value: 'loan', label: words.start.fromLoan, description: words.start.fromLoanHelp, disabled: props.loans.length === 0 },
  { value: 'offer', label: words.start.fromBlank, description: words.start.fromBlankHelp },
])
const loanItems = computed(() => props.loans.map((entry) => ({ label: entry.name, value: String(entry.id) })))

watch(open, (opened) => {
  if (!opened) return
  start.value = props.startLoan === null || props.loans.length === 0 ? 'offer' : 'loan'
  loan.value = (props.loans.find((entry) => entry.id === props.startLoan) ?? props.loans[0])?.id ?? ''
  name.value = ''
  tried.value = false
})

const nameError = computed(() => (name.value.trim() === '' ? words.start.nameError : null))

function next(): void {
  tried.value = true
  const chosen = props.loans.find((entry) => entry.id === loan.value) ?? null
  if (nameError.value !== null || (start.value === 'loan' && chosen === null)) return
  open.value = false
  emit('next', { name: name.value.trim(), loan: start.value === 'loan' ? (chosen?.id ?? null) : null, terms: null, changes: [], editing: null })
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.start.title" :description="words.start.description">
    <form id="new-scenario" class="flex flex-col gap-4" data-testid="new-scenario-form" @submit.prevent="next">
      <URadioGroup v-model="start" :items="starts" variant="card" data-testid="new-scenario-start" />
      <UFormField v-if="start === 'loan'" :label="words.start.loan">
        <USelect v-model="loan" :items="loanItems" class="w-full" data-testid="new-scenario-loan" />
      </UFormField>
      <UFormField :label="words.start.name" :error="(tried && nameError) || false">
        <UInput v-model="name" :placeholder="words.start.namePlaceholder" class="w-full" data-testid="new-scenario-name" />
      </UFormField>
    </form>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="new-scenario" :label="words.start.next" icon="i-lucide-arrow-right" trailing data-testid="new-scenario-next" />
    </template>
  </AppDialog>
</template>
