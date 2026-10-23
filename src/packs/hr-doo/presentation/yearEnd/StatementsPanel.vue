<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { YEAR_END_WRITES } from '../../domain/hrDooWrites'
import { YEAR_END_COLUMNS } from '../editorColumns'
import FactTabCard from '../../../../features/settings/presentation/FactTabCard.vue'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import type { RecordsRead } from '../../../../features/workbook/domain/recordsRead'
import type { YearEndLine } from '../../domain/yearEnd/yearEnd'
import { readYearEnd, yearEndLineOfFields } from '../../domain/yearEnd/yearEndReading'
import type { ClosedYearView } from './closedYearView'
import ComparisonTable from './ComparisonTable.vue'
import KontoTable from './KontoTable.vue'
import StatusBadge from './StatusBadge.vue'

/**
 * A closed year's statements line by line beside the accountant's, the konto lines, and the
 * accountant's lines to edit. A year that has ended without them has only the editor, open.
 */
const props = defineProps<{
  workbook: HrDooWorkbook
  year: number
  /** Null while the year has no accountant's lines. */
  view: ClosedYearView | null
}>()

const route = useRoute()

const categorySlugs = computed(() => new Set(props.workbook.categories.map((category) => category.slug)))
const readLines = (records: RecordsRead<YearEndLine>) => readYearEnd(records, categorySlugs.value)
/** A new line starts in the year on screen, on the profit and loss. */
const newLine = () => ({ year: String(props.year), statement: 'pl' })
</script>

<template>
  <div class="flex flex-col gap-6">
    <template v-if="view">
      <AppCard
        v-for="(table, index) in view.tables"
        :key="table.key"
        :title="table.title"
        :subtitle="`${table.description} Open a line for how ours is built.`"
        :collapse-id="`year.${table.key}`"
        :summary="table.summary"
        :start-collapsed="index > 0"
      >
        <div class="px-4 pt-3 pb-3 sm:px-3">
          <p v-if="table.rows.length === 0" class="py-4 text-sm text-muted">The year-end tab holds none of these lines for {{ year }}.</p>
          <ComparisonTable v-else :rows="table.rows" :test-id="`comparison-${table.key}`" />
        </div>
        <div v-if="table.key === 'tax' && (view.recorded.length > 0 || view.distribution)" class="flex flex-col gap-2 border-t border-default px-4 py-3 sm:px-5" data-testid="recorded-lines">
          <h3 class="text-xs font-medium text-muted">Dates and the distribution decision, as the accountant records them</h3>
          <ul class="flex flex-col">
            <li v-for="entry in view.recorded" :key="entry.key" class="recorded-row">
              <p class="min-w-0 text-sm text-toned">{{ entry.label }}</p>
              <p class="text-sm text-highlighted"><MoneyText v-if="'cents' in entry.value" :cents="entry.value.cents" /><template v-else>{{ entry.value.text }}</template></p>
              <div v-if="entry.check" class="recorded-check">
                <StatusBadge :status="entry.check.status" />
                <DrillLink :to="entry.check.to" :label="`${entry.check.finding}, open the rows`" class="text-xs text-muted">{{ entry.check.finding }}</DrillLink>
              </div>
            </li>
            <li v-if="view.distribution" class="recorded-row">
              <p class="min-w-0 text-sm text-toned">The decision shares out</p>
              <p class="text-sm text-highlighted"><MoneyText :cents="view.distribution.shared" /></p>
              <div class="recorded-check">
                <StatusBadge :status="view.distribution.residual === 0 ? 'matched' : 'open'" />
                <span class="text-xs text-muted">
                  Our profit after tax is <MoneyText :cents="view.distribution.profitAfterTax" /><template v-if="view.distribution.residual !== 0">, a residual of <MoneyText :cents="view.distribution.residual" sign="always" /></template>
                </span>
              </div>
            </li>
          </ul>
        </div>
      </AppCard>

      <AppCard title="Konto lines" collapse-id="year.konto" :summary="view.kontoSummary" start-collapsed>
        <template #subtitle>
          Each konto line beside our accrual figure for the categories its <span class="identifier">categories</span> cell names. Lines that share a category are
          compared together.
        </template>
        <div class="px-4 pt-2 pb-3 sm:px-5">
          <p v-if="view.konto.length === 0 && view.unnamedKonto.length === 0" class="py-4 text-sm text-muted">The year-end tab holds no konto lines for {{ year }}.</p>
          <KontoTable v-else :groups="view.konto" :unnamed="view.unnamedKonto" />
        </div>
      </AppCard>
    </template>

    <FactTabCard
      id="accountant-lines"
      :rules="YEAR_END_WRITES"
      title="The accountant's lines"
      description="The accountant's figures for every year, one row per year, statement and line, typed once from the year-end package. A konto row names the categories it matches."
      collapse-id="year.accountant-lines"
      :columns="YEAR_END_COLUMNS"
      :read="readLines"
      :make="yearEndLineOfFields"
      :new-row="newLine"
      row-noun="year-end line"
      tab-noun="year-end lines"
      saved-title="Year-end lines saved"
      start-collapsed
      :reveal="view === null || route.hash === '#accountant-lines'"
    />
  </div>
</template>

<style scoped>
.recorded-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.25rem 1rem;
  align-items: baseline;
  padding-block: 0.5rem;
}

.recorded-row + .recorded-row {
  border-top: 1px solid var(--border-default);
}

.recorded-check {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
}

@media (min-width: 640px) {
  .recorded-row {
    grid-template-columns: minmax(0, 14rem) 9rem minmax(0, 1fr);
  }

  .recorded-check {
    grid-column: auto;
  }
}
</style>
