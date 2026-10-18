<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { moneyFromAmount, negateMoney } from '../../../shared/money/money'
import { formatMoney } from '../../../shared/money/moneyFormat'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { useWorkbook } from '../../../features/workbook/application/workbookStore'
import type { OwnerAdvanceReceipt } from '../../../features/workbook/application/writePlans'
import { ADVANCE_BUCKETS } from '../../../features/workbook/domain/workbook'
import type { Category, OwnerAdvanceKind } from '../../../features/workbook/domain/workbook'

/** How long a toast with Undo stays, so there is time to reach the button. */
const UNDO_TOAST_DURATION = 10_000

const KIND_CHOICES: readonly { readonly kind: OwnerAdvanceKind; readonly label: string }[] = [
  { kind: 'paid-by-owner', label: 'I paid a company cost' },
  { kind: 'private-share', label: 'Part of a company payment was mine' },
]

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  categories: readonly Category[]
  /** The day the form starts on: the newest booking in the ledger. */
  defaultDate: CivilDate
  /** Where the advance is written, for the toast. */
  inSheet: boolean
}>()

const store = useWorkbook()
const toast = useToast()
const names = useDisplayNames()
const phone = usePhoneLayout()

const kind = ref<OwnerAdvanceKind>('paid-by-owner')
const date = ref<string>(props.defaultDate)
const amount = ref('')
const description = ref('')
const category = ref('')
const saving = ref(false)
const tried = ref(false)

watch(open, (opened) => {
  if (opened) {
    kind.value = 'paid-by-owner'
    date.value = props.defaultDate
    amount.value = ''
    description.value = ''
    category.value = ''
    tried.value = false
  }
})

/** Only the costs an advance can be: categories of the operating and taxes buckets. */
const categoryItems = computed(() =>
  props.categories
    .filter((candidate) => (ADVANCE_BUCKETS as readonly string[]).includes(candidate.bucket))
    .map((candidate) => ({ label: names.value.category(candidate.slug), value: candidate.slug, bucket: candidate.bucket })),
)

/** A decimal comma is read as a point, so 12,50 is twelve fifty. */
const parsedAmount = computed(() => {
  const text = amount.value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const cents = moneyFromAmount(Number(text))
  return cents > 0 ? cents : null
})

const errors = computed(() => ({
  date: parseCivilDate(date.value) === null ? 'A date, such as 2026-10-14' : null,
  amount: parsedAmount.value === null ? 'A positive amount with at most two decimals' : null,
  category: category.value === '' ? 'Choose the cost it was' : null,
}))

/** The tab holds a private share as a negative amount. */
const signedAmount = computed(() => (parsedAmount.value === null ? null : kind.value === 'private-share' ? negateMoney(parsedAmount.value) : parsedAmount.value))

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

async function undo(receipt: OwnerAdvanceReceipt): Promise<void> {
  try {
    await store.removeOwnerAdvance(receipt)
    toast.add({ title: 'Advance removed', description: 'The row is cleared from the owner-advances tab.', icon: 'i-lucide-undo-2', color: 'neutral' })
  } catch (failure) {
    toast.add({ title: 'Not removed', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: UNDO_TOAST_DURATION })
  }
}

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(date.value)
  if (!valid.value || day === null || parsedAmount.value === null || signedAmount.value === null) {
    return
  }
  saving.value = true
  try {
    const receipt = await store.addOwnerAdvance({ date: day, amount: signedAmount.value, description: description.value, category: category.value })
    open.value = false
    const privateShare = kind.value === 'private-share'
    toast.add({
      title: privateShare ? 'Private share added' : 'Advance added',
      description: `${formatMoney(parsedAmount.value)} ${privateShare ? 'off' : 'as'} ${names.value.category(category.value)}, written to the owner-advances tab${props.inSheet ? ' of the Sheet' : ''}${privateShare ? ' as a negative amount' : ''}.`,
      icon: 'i-lucide-check',
      color: 'success',
      duration: UNDO_TOAST_DURATION,
      actions: [{ label: 'Undo', icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => void undo(receipt) }],
    })
  } catch (failure) {
    toast.add({ title: 'Not added', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: UNDO_TOAST_DURATION })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Add an advance"
    description="A cost the owner paid privately for the company, or the private part of a payment the company made."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="add-advance" class="grid gap-4 sm:grid-cols-2" data-testid="add-advance" @submit.prevent="save">
        <div role="group" aria-label="Which way the money went" class="kind-choices sm:col-span-2" data-testid="advance-kind">
          <button v-for="choice in KIND_CHOICES" :key="choice.kind" type="button" class="kind-choice" :aria-pressed="kind === choice.kind" @click="kind = choice.kind">
            {{ choice.label }}
          </button>
        </div>
        <p class="-mt-2 text-xs text-muted sm:col-span-2">
          <template v-if="kind === 'private-share'">The private part comes off the cost on the day of the payment and counts as lent to the owner until the owner pays it back.</template>
          <template v-else>It counts as a cost on its date, and reimbursements to the owner repay it.</template>
        </p>
        <UFormField label="Date" :error="(tried && errors.date) || false">
          <UInput v-model="date" type="date" class="w-full" />
        </UFormField>
        <UFormField :label="kind === 'private-share' ? 'Private part' : 'Amount'" :error="(tried && errors.amount) || false">
          <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" />
        </UFormField>
        <UFormField
          label="Category"
          :error="(tried && errors.category) || false"
          :help="kind === 'private-share' ? 'The category of the company payment. Operating costs and taxes only.' : 'Operating costs and taxes only.'"
          class="sm:col-span-2"
        >
          <USelectMenu v-model="category" data-testid="advance-category" :items="categoryItems" value-key="value" placeholder="Choose a category" :search-input="{ placeholder: 'Search categories' }" class="w-full" />
        </UFormField>
        <UFormField label="What it was for" class="sm:col-span-2">
          <UInput v-model="description" :placeholder="kind === 'private-share' ? 'Private part of the online order' : 'Train tickets to the client'" class="w-full" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" :disabled="saving" @click="open = false" />
        <UButton type="submit" form="add-advance" label="Add advance" icon="i-lucide-plus" :loading="saving" :disabled="saving" />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.kind-choices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.125rem;
  padding: 0.125rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-control);
  background: var(--surface-raised);
}

.kind-choice {
  padding: 0.4375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--ink-muted);
  text-align: center;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

@media (hover: hover) {
  .kind-choice:hover {
    color: var(--ink-strong);
    background: var(--surface-elevated);
  }
}

.kind-choice[aria-pressed='true'] {
  color: var(--accent-strong);
  background: var(--accent-wash);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  font-weight: 500;
}

.kind-choice:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
