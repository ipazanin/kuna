<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { subtractMoney, ZERO } from '../../../../shared/money/money'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Transaction } from '../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { writeOwnerShare } from '../application/ownerShareWrites'
import { ownerPartOf, typedOwnerShare } from '../domain/ownerShare'
import type { ShareTarget } from '../domain/ownerShare'
import { words } from './words'

/** Sets the owner share of one payment, over the default its category gave it, with Undo in the toast. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  target: ShareTarget
  /** The payment as Transactions lists it, with its share. */
  row: Pick<Transaction, 'counterparty' | 'date' | 'amount' | 'category' | 'bucket' | 'ownerShare'>
}>()

const { state } = useWorkbook()
const writes = useRecordWrites(useWorkbook())
const names = useDisplayNames()

const textOf = (share: number | null): string => (share === null ? '' : String(share))

const typed = ref('')
watch(
  open,
  (opened) => {
    if (opened) typed.value = textOf(props.row.ownerShare)
  },
  { immediate: true },
)

const share = computed(() => typedOwnerShare(typed.value))
const categoryDefault = computed(() => state.workbook?.categories.find((category) => category.slug === props.row.category)?.ownerShare ?? null)
const changed = computed(() => share.value !== undefined && share.value !== props.row.ownerShare)

const ownerPart = computed(() => (share.value === undefined || share.value === null ? ZERO : ownerPartOf(props.row.amount, share.value)))
const companyPart = computed(() => subtractMoney(props.row.amount, ownerPart.value))

const defaultInWords = computed(() =>
  categoryDefault.value === null ? words.shareDialog.noDefault(names.value.category(props.row.category)) : words.shareDialog.defaultIs(names.value.category(props.row.category), categoryDefault.value),
)

async function save(): Promise<void> {
  const records = state.records
  const saved = share.value
  if (records === null || saved === undefined || !changed.value) return
  const written = await writes.write(saved === null ? words.shareDialog.cleared : words.shareDialog.setTo(saved), (unit) => writeOwnerShare(unit, records, props.target, saved), {
    failedTitle: words.shareDialog.notSaved,
    description: props.row.counterparty || words.shareDialog.noCounterpartyRow,
  })
  if (written) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" width="md" :title="words.shareDialog.title" :description="words.shareDialog.description(row.counterparty, dayLabel(row.date))">
    <form id="owner-share" class="flex flex-col gap-4" data-testid="owner-share" @submit.prevent="save">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <CategoryChip :category="row.category" :bucket="row.bucket" />
        <MoneyText :cents="row.amount" tone="flow" class="font-medium" />
      </div>
      <UFormField :label="words.shareDialog.share" :help="defaultInWords" :error="share === undefined ? words.shareDialog.shareError : false">
        <div class="flex flex-wrap items-center gap-2">
          <UInput v-model="typed" inputmode="numeric" :placeholder="words.shareDialog.none" class="w-28" :aria-label="words.shareDialog.shareLabel" data-testid="owner-share-input">
            <template #trailing><span class="text-muted">%</span></template>
          </UInput>
          <UButton
            :label="words.shareDialog.useDefault"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="typed.trim() === textOf(categoryDefault)"
            data-testid="owner-share-default"
            @click="typed = textOf(categoryDefault)"
          />
        </div>
      </UFormField>
      <dl class="split" data-testid="owner-share-split">
        <dt>{{ words.shareDialog.companyKeeps }}</dt>
        <dd><MoneyText :cents="companyPart" sign="magnitude" /></dd>
        <dt>{{ words.shareDialog.youTake }}</dt>
        <dd><MoneyText :cents="ownerPart" sign="magnitude" /></dd>
      </dl>
      <p class="text-xs text-muted">{{ words.shareDialog.note }}</p>
    </form>
    <template #end>
      <UButton :label="words.shareDialog.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="owner-share"
        :label="words.shareDialog.save"
        icon="i-lucide-check"
        :loading="writes.busy.value"
        :disabled="!changed || writes.busy.value || state.writing"
        data-testid="owner-share-save"
      />
    </template>
  </AppDialog>
</template>

<style scoped>
.split {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.375rem 1rem;
  font-size: 0.875rem;
}

.split dt {
  color: var(--ui-text-toned);
}

.split dd {
  text-align: end;
  color: var(--ui-text-highlighted);
}
</style>
