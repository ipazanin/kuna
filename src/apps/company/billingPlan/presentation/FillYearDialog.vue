<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { sumMoney } from '../../../../shared/money/money'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { TERMS_LINK } from '../../invoicing/presentation/invoicingLinks'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { BILLING_WRITES, newBillingItem } from '../application/billingWrites'
import type { BillingItemDraft, RestOfYearFill } from '../domain/fillRestOfYear'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  fill: RestOfYearFill
  /** Such as "Fill the rest of 2026", or "Fill 2027" for a year still to come. */
  title: string
  clientName: string
  /** The item colours of the plan, so a filled row wears its item's colour. */
  colours: ReadonlyMap<string, string>
}>()

const writes = useRecordWrites(useWorkbook())

const rows = computed(() => (props.fill.kind === 'rows' ? props.fill.rows : []))
const total = computed(() => sumMoney(rows.value.map((row) => row.amount)))

/** The descriptions edited in the preview, by row. A row not edited keeps the one the fill proposes. */
const edited = ref<Record<string, string>>({})

watch(open, (opened) => {
  if (opened) edited.value = {}
})

function keyOf(row: BillingItemDraft): string {
  return `${row.date} ${row.item}`
}

function descriptionOf(row: BillingItemDraft): string {
  return edited.value[keyOf(row)] ?? row.description
}

async function write(): Promise<void> {
  const count = rows.value.length
  const added = rows.value.map((row) => newBillingItem({ ...row, description: descriptionOf(row) }))
  const written = await writes.write(count === 1 ? 'Plan row added' : `${count} plan rows added`, (unit) => added.forEach((item) => unit.of(BILLING_WRITES).add(item)), { failedTitle: 'Not added' })
  if (written) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="title"
    description="The monthly fee and the subscription for every month to December that has no row of them yet. Each description follows the item's latest row, with its month moved on, and can be edited before the rows are added."
  >
    <div class="flex flex-col gap-3" data-testid="fill-preview">
      <p v-if="fill.kind === 'refused'" class="text-sm text-toned">
        {{ fill.reason }} The terms are on <DrillLink :to="TERMS_LINK" in-prose class="text-highlighted" @click="open = false">Invoicing, Clients</DrillLink>.
      </p>
      <p v-else-if="rows.length === 0" class="text-sm text-toned">Every month to December already has its rows for {{ clientName }}. Nothing to add.</p>
      <template v-else>
        <p class="text-sm text-toned">
          {{ rows.length }} {{ rows.length === 1 ? 'row' : 'rows' }} for {{ clientName }}, <MoneyText :cents="total" /> in all, appended to the foot of the outgoing-plan tab.
        </p>
        <ul class="flex flex-col">
          <li v-for="row in rows" :key="keyOf(row)" class="fill-row" data-testid="fill-row">
            <span class="swatch" :style="{ background: colours.get(row.item) ?? 'var(--chart-deemphasis)' }" aria-hidden="true" />
            <span class="min-w-0">
              <span class="block truncate text-sm text-highlighted">{{ row.item }}</span>
              <span class="figure block text-xs text-muted">{{ dayLabel(row.date) }}</span>
            </span>
            <MoneyText :cents="row.amount" class="text-sm text-toned" />
            <UInput
              :model-value="descriptionOf(row)"
              size="sm"
              class="fill-description"
              placeholder="Description"
              :aria-label="`Description of the ${row.item} row of ${dayLabel(row.date)}`"
              data-testid="fill-description"
              @update:model-value="edited = { ...edited, [keyOf(row)]: String($event) }"
            />
          </li>
        </ul>
      </template>
    </div>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        :label="rows.length === 0 ? 'Add rows' : `Add ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`"
        icon="i-lucide-calendar-plus"
        :loading="writes.busy.value"
        :disabled="rows.length === 0 || writes.busy.value"
        data-testid="fill-write"
        @click="write"
      />
    </template>
  </AppDialog>
</template>

<style scoped>
.fill-row {
  display: grid;
  grid-template-columns: 0.625rem minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 0.625rem;
  row-gap: 0.375rem;
  padding: 0.5rem 0;
}

.fill-description {
  grid-column: 2 / -1;
}

.fill-row + .fill-row {
  border-top: 1px solid var(--border-default);
}

.swatch {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
}
</style>
