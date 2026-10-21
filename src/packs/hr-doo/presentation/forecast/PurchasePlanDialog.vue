<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { ASSET_GROUPS } from '../../../../features/workbook/domain/assets'
import type { AssetGroup } from '../../../../features/workbook/domain/assets'
import type { PlanLine } from '../../../../features/workbook/domain/plan'
import { parseCivilDate, yearOf } from '../../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import type { Money } from '../../../../shared/money/money'
import { purchasePlanCells } from '../../application/planRows'
import AddTabNotice from '../../../../features/workbook/presentation/AddTabNotice.vue'
import { GROUP_WORDS, fieldAmount } from './planWording'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { usePlanWrites } from './usePlanWrites'

type PurchaseLine = Extract<PlanLine, { readonly kind: 'purchase' }>

/** A planned purchase: what it is, the day it is bought and put in use, its net cost and its depreciation group. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  /** The purchase to edit, or null to add one. */
  purchase: PurchaseLine | null
}>()

const writes = usePlanWrites()
const phone = usePhoneLayout()

const name = ref('')
const date = ref('')
const amount = ref('')
const group = ref<AssetGroup>('computers')
const tried = ref(false)

const groups = ASSET_GROUPS.map((value) => ({ label: GROUP_WORDS[value], value }))

watch(
  open,
  (opened) => {
    if (!opened) return
    name.value = props.purchase?.note ?? ''
    date.value = props.purchase?.date ?? ''
    amount.value = props.purchase === null ? '' : fieldAmount(props.purchase.amount)
    group.value = props.purchase?.group ?? 'computers'
    tried.value = false
  },
  { immediate: true },
)

const day = computed(() => parseCivilDate(date.value.trim()))
const cost = computed(() => typedAmount(amount.value))
const errors = computed(() => ({
  name: name.value.trim() === '' ? 'Say what it is' : null,
  date: day.value === null || yearOf(day.value) !== props.year ? `A day in ${props.year}` : null,
  amount: cost.value === null || cost.value <= 0 ? 'An amount above zero with at most two decimals' : null,
}))
const valid = computed(() => Object.values(errors.value).every((error) => error === null))

async function save(): Promise<void> {
  tried.value = true
  if (!valid.value || day.value === null) return
  const cells = purchasePlanCells(props.year, day.value, cost.value as Money, group.value, name.value)
  const before = props.purchase === null ? null : writes.rowOf(props.purchase)
  if (props.purchase !== null && before === null) return
  const change = before === null ? { added: [cells], changed: [], removed: [] } : { added: [], changed: [{ sheetRow: before.sheetRow, before: before.cells, after: cells }], removed: [] }
  if (await writes.write(change, { title: props.purchase === null ? 'Purchase planned' : 'Purchase saved', description: `${name.value.trim()}, written to ${writes.where()}.` }, 'Not saved')) open.value = false
}

async function remove(): Promise<void> {
  const row = props.purchase === null ? null : writes.rowOf(props.purchase)
  if (row === null) return
  if (await writes.write({ added: [], changed: [], removed: [row] }, { title: 'Purchase deleted', description: `Row ${row.sheetRow} of ${writes.where()} is taken out.` }, 'Not deleted')) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="purchase === null ? `Plan a purchase in ${year}` : 'Edit the planned purchase'"
    description="It joins the asset books on its day. Above the asset threshold it is depreciated from the month after, at or below it is written off in its month."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="purchase-plan" class="grid gap-4 sm:grid-cols-2" data-testid="purchase-plan-form" @submit.prevent="save">
        <UFormField label="What it is" :error="(tried && errors.name) || false" class="sm:col-span-2">
          <UInput v-model="name" placeholder="Replacement laptop" class="w-full" data-testid="purchase-name" />
        </UFormField>
        <UFormField label="Bought and put in use" :error="(tried && errors.date) || false">
          <UInput v-model="date" type="date" class="w-full" data-testid="purchase-date" />
        </UFormField>
        <UFormField label="Net cost" help="Without the VAT that is reclaimed." :error="(tried && errors.amount) || false">
          <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="purchase-amount" />
        </UFormField>
        <UFormField label="Depreciation group" class="sm:col-span-2">
          <USelect v-model="group" :items="groups" class="w-full" data-testid="purchase-group" />
        </UFormField>
        <AddTabNotice v-if="writes.tabMissing.value" tab="plan" :headers="writes.headers" class="sm:col-span-2" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton v-if="purchase !== null" label="Delete purchase" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="purchase-delete" @click="remove" />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="purchase-plan"
            :label="purchase === null ? 'Plan purchase' : 'Save purchase'"
            :icon="purchase === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
            data-testid="purchase-save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
