<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { usePhoneLayout } from '../../../shared/layout/viewport'
import { formatMoney } from '../../../shared/money/moneyFormat'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import CategoryPicker from '../../../features/transactions/presentation/CategoryPicker.vue'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { useWorkbook } from '../../../features/workbook/application/workbookStore'
import type { PrivateShareToMove } from '../../../features/workbook/domain/workbook'
import { TEMPLATE_COLUMNS } from '../../../features/workbook/infrastructure/workbookTemplate'
import AddTabNotice from '../../../features/workbook/presentation/AddTabNotice.vue'
import { moveShareToSplits } from '../application/privateShareMove'
import { SHARE_DAYS, privateShareCandidates, privateShareCategories, privateShareSplit } from '../domain/countedSplits'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  share: PrivateShareToMove
}>()

const store = useWorkbook()
const toast = useToast()
const names = useDisplayNames()
const phone = usePhoneLayout()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** The bank rows the share may have come off, from the ledger as read. */
const candidates = computed(() => (store.state.workbook === null ? [] : privateShareCandidates(store.state.workbook, props.share)))
const privateCategories = computed(() => privateShareCategories(store.state.workbook?.categories ?? []))

const chosenRow = ref<number | undefined>(undefined)
const chosenCategory = ref<string | undefined>(undefined)
const moving = ref(false)

watch(
  open,
  (opened) => {
    if (!opened) return
    chosenRow.value = candidates.value.length === 1 ? candidates.value[0]!.sheetRow : undefined
    chosenCategory.value = privateCategories.value[0]?.slug
  },
  { immediate: true },
)

const row = computed(() => candidates.value.find((candidate) => candidate.sheetRow === chosenRow.value) ?? null)
const privateCategory = computed(() => privateCategories.value.find((category) => category.slug === chosenCategory.value) ?? null)
const parts = computed(() => (row.value === null || privateCategory.value === null ? null : privateShareSplit(props.share, row.value, privateCategory.value).parts))

const rowItems = computed(() =>
  candidates.value.map((candidate) => ({
    value: candidate.sheetRow,
    label: `${dayFormat.format(new Date(candidate.date))}, ${candidate.counterparty || 'No counterparty'}, ${formatMoney(candidate.amount)}`,
    description: `${names.value.account(candidate.account)}, ledger row ${candidate.sheetRow}`,
  })),
)

const tabMissing = computed(() => store.state.choice?.source === 'google' && (store.state.snapshot?.meta.missingTabs.includes('splits') ?? false))
const headers = TEMPLATE_COLUMNS.splits.map((column) => column.name).join(', ')

async function move(): Promise<void> {
  const [payment, category] = [row.value, privateCategory.value]
  if (payment === null || category === null) return
  moving.value = true
  try {
    await moveShareToSplits(store, props.share, payment, category, tabMissing.value)
    toast.add({
      title: 'Moved to splits',
      description: `${formatMoney(props.share.amount)} of the payment to ${payment.counterparty || 'the payee'} is now a part in ${names.value.category(category.slug)}, and its owner-advances row is cleared.`,
      icon: 'i-lucide-check',
      color: 'success',
    })
    open.value = false
  } catch (failure) {
    toast.add({ title: 'Not moved', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  } finally {
    moving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Move the private share to splits"
    :description="`${share.description || 'A private share'}, ${formatMoney(share.amount)} off ${names.category(share.category)} on ${dayFormat.format(new Date(share.date))}, row ${share.sheetRow} of the owner-advances tab.`"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="move-share">
        <p v-if="privateCategories.length === 0" class="text-sm text-toned">
          No category carries the owner-loan-out role, so the share has nowhere to go. Give one the role on Workbook, Categories first.
        </p>
        <p v-else-if="candidates.length === 0" class="text-sm text-toned" data-testid="move-share-no-row">
          No ledger row in {{ names.category(share.category) }} within {{ SHARE_DAYS }} days of the share paid more than it. Split the payment by hand on Transactions, then delete
          the row on the owner-advances tab in the Sheet.
        </p>
        <template v-else>
          <UFormField :label="candidates.length === 1 ? 'The payment it came off' : 'Which payment it came off'">
            <URadioGroup v-bind="chosenRow === undefined ? {} : { modelValue: chosenRow }" :items="rowItems" data-testid="move-share-rows" @update:model-value="chosenRow = $event" />
          </UFormField>
          <UFormField label="Where the owner’s part goes" help="A category with the owner-loan-out role, so the loan book counts it as lent to the owner until it is repaid.">
            <CategoryPicker v-model="chosenCategory" :categories="privateCategories" class="w-full" data-testid="move-share-category" />
          </UFormField>
          <section v-if="parts" class="flex flex-col gap-1" aria-label="The split it writes">
            <h3 class="text-xs font-medium text-muted">The split it writes</h3>
            <p v-for="(part, index) in parts" :key="index" class="flex items-baseline justify-between gap-3 text-sm" data-testid="move-share-part">
              <span class="min-w-0 truncate text-toned">{{ names.category(part.category) }}<template v-if="part.note">, {{ part.note }}</template></span>
              <MoneyText :cents="part.amount" tone="flow" class="shrink-0" />
            </p>
          </section>
          <AddTabNotice v-if="tabMissing" tab="splits" :headers="headers" />
          <p class="text-xs text-muted">
            The split goes on the splits tab first, then the owner-advances row is cleared. Net owed reads the same before and after. The app cannot move it back, since the
            owner-advances tab no longer takes a negative amount, but the split can be edited on Transactions.
          </p>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" :disabled="moving" @click="open = false" />
        <UButton
          label="Move to splits"
          icon="i-lucide-split"
          :loading="moving"
          :disabled="moving || store.state.writing || parts === null"
          data-testid="move-share-confirm"
          @click="move"
        />
      </div>
    </template>
  </UModal>
</template>
