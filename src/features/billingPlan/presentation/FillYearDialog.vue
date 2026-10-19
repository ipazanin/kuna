<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { usePhoneLayout } from '../../../shared/layout/viewport'
import { sumMoney } from '../../../shared/money/money'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import { BILLING_PLAN_ROWS, billingCellsOf } from '../application/billingPlanRows'
import type { RestOfYearFill } from '../domain/fillRestOfYear'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  fill: RestOfYearFill
  clientName: string
  /** The item colours of the plan, so a filled row wears its item's colour. */
  colours: ReadonlyMap<string, string>
}>()

const writes = useRowWrites(BILLING_PLAN_ROWS)
const phone = usePhoneLayout()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const rows = computed(() => (props.fill.kind === 'rows' ? props.fill.rows : []))
const total = computed(() => sumMoney(rows.value.map((row) => row.amount)))

async function write(): Promise<void> {
  const count = rows.value.length
  const added = await writes.write({ added: rows.value.map(billingCellsOf), changed: [], removed: [] }, { title: count === 1 ? 'Plan row added' : `${count} plan rows added` }, 'Not added')
  if (added) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Fill the rest of the year"
    description="The monthly fee and the subscription for every month to December that has no row of them yet. Adjust each row afterwards as the month turns out."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <div class="flex flex-col gap-3" data-testid="fill-preview">
        <p v-if="fill.kind === 'refused'" class="text-sm text-toned">
          {{ fill.reason }} The terms are on
          <DrillLink to="/workbook" in-prose class="text-highlighted">Workbook, General</DrillLink>.
        </p>
        <p v-else-if="rows.length === 0" class="text-sm text-toned">Every month to December already has its rows for {{ clientName }}. Nothing to add.</p>
        <template v-else>
          <p class="text-sm text-toned">
            {{ rows.length }} {{ rows.length === 1 ? 'row' : 'rows' }} for {{ clientName }}, <MoneyText :cents="total" /> in all, appended to the foot of the outgoing-plan tab.
          </p>
          <ul class="flex flex-col">
            <li v-for="row in rows" :key="`${row.date}-${row.item}`" class="fill-row" data-testid="fill-row">
              <span class="swatch" :style="{ background: colours.get(row.item) ?? 'var(--chart-deemphasis)' }" aria-hidden="true" />
              <span class="min-w-0">
                <span class="block truncate text-sm text-highlighted">{{ row.item }}</span>
                <span class="figure block text-xs text-muted">{{ dayFormat.format(new Date(row.date)) }}, {{ row.description }}</span>
              </span>
              <MoneyText :cents="row.amount" class="text-sm text-toned" />
            </li>
          </ul>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
        <UButton
          :label="rows.length === 0 ? 'Add rows' : `Add ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`"
          icon="i-lucide-calendar-plus"
          :loading="writes.busy.value"
          :disabled="rows.length === 0 || writes.busy.value"
          data-testid="fill-write"
          @click="write"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.fill-row {
  display: grid;
  grid-template-columns: 0.625rem minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 0.625rem;
  padding: 0.5rem 0;
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
