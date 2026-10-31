<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { ASSET_GROUPS } from '../../domain/assets/assets'
import type { AssetGroup } from '../../domain/assets/assets'
import type { PlanLine } from '../../domain/forecast/plan'
import { parseCivilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../../shared/money/money'
import { purchasePlanLine, replacePlanLines } from '../../application/planWrites'
import { GROUP_WORDS, fieldAmount } from './planWording'
import { typedAmount } from '../../../../../../shared/money/typedAmount'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../../../shared/ui/FormGrid.vue'
import { usePlanWrites } from './usePlanWrites'
import { words } from './words'

type PurchaseLine = Extract<PlanLine, { readonly kind: 'purchase' }>

/** A planned purchase: what it is, the day it is bought and put in use, its net cost and its depreciation group. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  year: number
  /** The purchase to edit, or null to add one. */
  purchase: PurchaseLine | null
}>()

const writes = usePlanWrites()

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
  name: name.value.trim() === '' ? words.planDialogs.purchase.nameError : null,
  date: day.value === null || yearOf(day.value) !== props.year ? words.planDialogs.purchase.dateError(props.year) : null,
  amount: cost.value === null || cost.value <= 0 ? words.planDialogs.purchase.amountError : null,
}))
const valid = computed(() => Object.values(errors.value).every((error) => error === null))

async function save(): Promise<void> {
  tried.value = true
  if (!valid.value || day.value === null) return
  const line = purchasePlanLine(props.year, day.value, cost.value as Money, group.value, name.value)
  const before = props.purchase === null ? null : writes.stored(props.purchase)
  if (props.purchase !== null && before === null) return
  const held = before === null ? [] : [{ key: 'purchase', line: before }]
  const title = props.purchase === null ? words.planDialogs.purchase.planned : words.planDialogs.purchase.saved
  if (await writes.write(title, (lines) => replacePlanLines(lines, held, [{ key: 'purchase', line }]), { description: `${name.value.trim()}.`, failedTitle: words.planDialogs.notSaved }))
    open.value = false
}

async function remove(): Promise<void> {
  const before = props.purchase === null ? null : writes.stored(props.purchase)
  if (before === null) return
  if (
    await writes.write(words.planDialogs.purchase.deleted, (lines) => lines.remove(before), {
      description: words.planDialogs.purchase.takenOut(name.value.trim()),
      failedTitle: words.planDialogs.notDeleted,
    })
  )
    open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="purchase === null ? words.planDialogs.purchase.addTitle(year) : words.planDialogs.purchase.editTitle" :description="words.planDialogs.purchase.description">
    <FormGrid id="purchase-plan" as="form" data-testid="purchase-plan-form" @submit.prevent="save">
      <UFormField :label="words.planDialogs.purchase.name" :error="(tried && errors.name) || false" class="sm:col-span-2">
        <UInput v-model="name" :placeholder="words.planDialogs.purchase.namePlaceholder" class="w-full" data-testid="purchase-name" />
      </UFormField>
      <UFormField :label="words.planDialogs.purchase.date" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" data-testid="purchase-date" />
      </UFormField>
      <UFormField :label="words.planDialogs.purchase.cost" :help="words.planDialogs.purchase.costHelp" :error="(tried && errors.amount) || false">
        <UInput v-model="amount" inputmode="decimal" :placeholder="words.planDialogs.amountPlaceholder" class="w-full" data-testid="purchase-amount" />
      </UFormField>
      <UFormField :label="words.planDialogs.purchase.group" class="sm:col-span-2">
        <USelect v-model="group" :items="groups" class="w-full" data-testid="purchase-group" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="purchase !== null"
        :label="words.planDialogs.purchase.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="purchase-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="words.planDialogs.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="purchase-plan"
        :label="purchase === null ? words.planDialogs.purchase.add : words.planDialogs.purchase.save"
        :icon="purchase === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="purchase-save"
      />
    </template>
  </AppDialog>
</template>
