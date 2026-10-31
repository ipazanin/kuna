<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { PlanLine } from '../../domain/forecast/plan'
import type { Money } from '../../../../../../shared/money/money'
import { dividendPlanLine, replacePlanLines } from '../../application/planWrites'
import { fieldAmount, monthsOf } from './planWording'
import { typedAmount } from '../../../../../../shared/money/typedAmount'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../../../shared/ui/FormGrid.vue'
import { usePlanWrites } from './usePlanWrites'
import { words } from './words'

type AmountLine = Extract<PlanLine, { readonly kind: 'amount' }>

/** The year's planned dividend: its amount before tax and the month it is paid. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  /** The dividend row to edit, or null to plan one. */
  dividend: AmountLine | null
}>()

const writes = usePlanWrites()

const amount = ref('')
const month = ref(6)
const note = ref('')
const tried = ref(false)

const months = computed(() => monthsOf(props.year).map((entry) => ({ label: entry.name, value: entry.number })))

watch(
  open,
  (opened) => {
    if (!opened) return
    amount.value = props.dividend === null ? '' : fieldAmount(props.dividend.amount)
    month.value = props.dividend?.month ?? 6
    note.value = props.dividend?.note ?? ''
    tried.value = false
  },
  { immediate: true },
)

const gross = computed(() => typedAmount(amount.value))
const invalid = computed(() => gross.value === null || gross.value <= 0)

async function save(): Promise<void> {
  tried.value = true
  if (invalid.value) return
  const line = dividendPlanLine(props.year, month.value, gross.value as Money, note.value)
  const before = props.dividend === null ? null : writes.stored(props.dividend)
  if (props.dividend !== null && before === null) return
  const held = before === null ? [] : [{ key: 'dividend', line: before }]
  if (
    await writes.write(words.planDialogs.dividend.planned, (lines) => replacePlanLines(lines, held, [{ key: 'dividend', line }]), {
      description: words.planDialogs.dividend.forYear(props.year),
      failedTitle: words.planDialogs.notSaved,
    })
  )
    open.value = false
}

async function remove(): Promise<void> {
  const before = props.dividend === null ? null : writes.stored(props.dividend)
  if (before === null) return
  if (
    await writes.write(words.planDialogs.dividend.deleted, (lines) => lines.remove(before), {
      description: words.planDialogs.dividend.takenOut(props.year),
      failedTitle: words.planDialogs.notDeleted,
    })
  )
    open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="dividend === null ? words.planDialogs.dividend.addTitle(year) : words.planDialogs.dividend.editTitle" :description="words.planDialogs.dividend.description">
    <FormGrid id="dividend-plan" as="form" data-testid="dividend-plan-form" @submit.prevent="save">
      <UFormField :label="words.planDialogs.dividend.amount" :error="(tried && invalid && words.planDialogs.dividend.amountError) || false">
        <UInput v-model="amount" inputmode="decimal" :placeholder="words.planDialogs.amountPlaceholder" class="w-full" data-testid="dividend-amount" />
      </UFormField>
      <UFormField :label="words.planDialogs.dividend.paidIn">
        <USelect v-model="month" :items="months" class="w-full" data-testid="dividend-month" />
      </UFormField>
      <UFormField :label="words.planDialogs.dividend.note" class="sm:col-span-2">
        <UInput v-model="note" :placeholder="words.planDialogs.dividend.notePlaceholder" class="w-full" data-testid="dividend-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="dividend !== null"
        :label="words.planDialogs.dividend.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="dividend-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="words.planDialogs.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="dividend-plan"
        :label="dividend === null ? words.planDialogs.dividend.add : words.planDialogs.dividend.save"
        :icon="dividend === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="dividend-save"
      />
    </template>
  </AppDialog>
</template>
