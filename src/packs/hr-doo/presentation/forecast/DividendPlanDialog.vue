<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { PlanLine } from '../../../../features/workbook/domain/plan'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import type { Money } from '../../../../shared/money/money'
import { dividendPlanCells } from '../../application/planRows'
import AddTabNotice from '../../../../features/workbook/presentation/AddTabNotice.vue'
import { fieldAmount, monthsOf } from './planWording'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { usePlanWrites } from './usePlanWrites'

type AmountLine = Extract<PlanLine, { readonly kind: 'amount' }>

/** The year's planned dividend: its amount before tax and the month it is paid. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  /** The dividend row to edit, or null to plan one. */
  dividend: AmountLine | null
}>()

const writes = usePlanWrites()
const phone = usePhoneLayout()

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
  const cells = dividendPlanCells(props.year, month.value, gross.value as Money, note.value)
  const before = props.dividend === null ? null : writes.rowOf(props.dividend)
  if (props.dividend !== null && before === null) return
  const change = before === null ? { added: [cells], changed: [], removed: [] } : { added: [], changed: [{ before, after: cells }], removed: [] }
  if (await writes.write(change, { title: 'Dividend planned', description: `For ${props.year}, written to ${writes.where()}.` }, 'Not saved')) open.value = false
}

async function remove(): Promise<void> {
  const row = props.dividend === null ? null : writes.rowOf(props.dividend)
  if (row === null) return
  if (await writes.write({ added: [], changed: [], removed: [row] }, { title: 'Dividend deleted', description: `The dividend of ${props.year} is taken out of ${writes.where()}.` }, 'Not deleted')) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="dividend === null ? `Plan a dividend in ${year}` : 'Edit the planned dividend'"
    description="The payout before its tax. The tax is withheld when it is paid, and the rest settles what the owner owes the company before any of it leaves the cash."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="dividend-plan" class="grid gap-4 sm:grid-cols-2" data-testid="dividend-plan-form" @submit.prevent="save">
        <UFormField label="Dividend before tax" :error="(tried && invalid && 'An amount above zero with at most two decimals') || false">
          <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="dividend-amount" />
        </UFormField>
        <UFormField label="Paid in">
          <USelect v-model="month" :items="months" class="w-full" data-testid="dividend-month" />
        </UFormField>
        <UFormField label="Note" class="sm:col-span-2">
          <UInput v-model="note" placeholder="After the statements are adopted" class="w-full" data-testid="dividend-note" />
        </UFormField>
        <AddTabNotice v-if="writes.tabMissing.value" tab="plan" :headers="writes.headers" class="sm:col-span-2" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton v-if="dividend !== null" label="Delete dividend" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="dividend-delete" @click="remove" />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="dividend-plan"
            :label="dividend === null ? 'Plan dividend' : 'Save dividend'"
            :icon="dividend === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
            data-testid="dividend-save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
