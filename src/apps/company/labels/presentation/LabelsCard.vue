<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { labelFigure } from '../../../../shared/categorising/domain/labels'
import { ruleCounts } from '../../../../shared/categorising/domain/rulesFiling'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import CountLink from '../../../../shared/ui/CountLink.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { DEFAULT_FILTERS } from '../../filters/domain/filterState'
import { installedPack } from '../../packs/packContribution'
import { ruleTargetsOf } from '../../rules/domain/ruleTargets'
import { rulesCountLink } from '../../rules/presentation/rulesCountLink'
import { rulesOfLabelLink, SORTING_CARDS } from '../../sorting/presentation/sortingLinks'
import { useSettings } from '../../settings/application/useSettings'
import { lineLabel, lineShown } from '../../settings/domain/profitAndLossLabels'
import { countedLedger } from '../../transactions/domain/countedLedger'
import { labelLink } from '../../transactions/presentation/transactionsLinks'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import { storesItems } from '../../workbook/domain/rowItems'
import { labelTotals } from '../domain/labelTotals'
import LabelDialog from './LabelDialog.vue'
import { words } from './words'

/** The Labels card of Sorting: every label with its result, income less costs, or only its costs in ink when it has no income, and the lines under it, a label nothing carries first, then the newest. Each opens its rows of every month on Transactions. */
const { state } = useWorkbook()
const settings = useSettings()

const route = useRoute()

const beforeItems = computed(() => state.records !== null && !storesItems(state.records))
const rulesOn = computed(() => ruleCounts(state.workbook?.rules ?? [], ruleTargetsOf))

/** The lines a label lists under its result, each only when it holds money. */
const LINES: readonly ProfitAndLossLine[] = ['income', 'operating', 'taxes', 'ownerPay']

const lines = computed(() => {
  const workbook = state.workbook
  if (workbook === null) return []
  const cash = countedLedger(workbook, DEFAULT_FILTERS, installedPack().vatOnPrivateShare)?.workbook
  return labelTotals(cash?.transactions ?? [], cash?.ownerAdvances ?? [], workbook.itemLabels, workbook.labels).map((totals) => ({
    totals,
    figure: labelFigure(totals.profitAndLoss.income, totals.profitAndLoss.cost),
    caption: totals.latest === null ? words.noParts : `${plural(words.parts(totals.parts), totals.parts)} · ${words.newest(dayLabel(totals.latest))}`,
    lines: LINES.filter((line) => lineShown(settings.value, line) && totals.profitAndLoss[line] !== 0).map((line) => ({
      line,
      name: lineLabel(settings.value, line),
      amount: formatMoney(totals.profitAndLoss[line]),
    })),
  }))
})

const editing = ref<Label | null>(null)
const dialogOpen = ref(false)

function openDialog(label: Label | null): void {
  editing.value = label
  dialogOpen.value = true
}
</script>

<template>
  <div v-if="state.workbook !== null">
    <EmptyState
      v-if="lines.length === 0"
      :id="SORTING_CARDS.labels"
      icon="i-lucide-tag"
      :title="words.empty.title"
      :description="beforeItems ? words.empty.beforeItems : words.empty.description"
      data-testid="company-labels-empty"
    >
      <template v-if="!beforeItems" #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="company-label-add" @click="openDialog(null)" />
      </template>
    </EmptyState>
    <AppCard
      v-else
      :id="SORTING_CARDS.labels"
      :title="words.title"
      :subtitle="words.subtitle"
      collapse-id="company-sorting.labels"
      :summary="plural(words.count(lines.length), lines.length)"
      :reveal="route.hash === `#${SORTING_CARDS.labels}`"
      data-testid="company-labels"
    >
      <template v-if="!beforeItems" #actions>
        <UButton :label="words.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="company-label-add" @click="openDialog(null)" />
      </template>
      <ul class="near-figures flex flex-col py-2">
        <li v-for="line in lines" :key="line.totals.label.id" class="flex flex-col border-t border-default first:border-t-0" data-testid="company-label-row">
          <div class="flex items-start">
            <ListRow :to="labelLink(line.totals.label)" :title="line.totals.label.name" :caption="line.caption" class="min-w-0 flex-1" data-testid="company-label-open">
              <template v-if="line.totals.parts > 0" #amount>
                <MoneyText v-if="line.figure.counts === 'result'" :cents="line.figure.amount" tone="outcome" />
                <MoneyText v-else :cents="line.figure.amount" />
              </template>
              <template v-if="line.lines.length > 0" #details>
                <span class="flex flex-col gap-0.5">
                  <span v-for="shown in line.lines" :key="shown.line" class="flex items-center gap-2 type-caption" data-testid="company-label-line">
                    <span class="min-w-0 flex-1 break-words">{{ shown.name }}</span>
                    <span class="figure shrink-0">{{ shown.amount }}</span>
                  </span>
                </span>
              </template>
            </ListRow>
            <UButton
              v-if="!beforeItems"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="words.change(line.totals.label.name)"
              class="me-2 mt-2 shrink-0 sm:me-3"
              data-testid="company-label-change"
              @click="openDialog(line.totals.label)"
            />
          </div>
          <CountLink v-bind="rulesCountLink(rulesOn.get(line.totals.label.id) ?? 0, line.totals.label.name)" :to="rulesOfLabelLink(line.totals.label)" class="-mt-3 mb-2 ms-4 self-start sm:ms-5" />
        </li>
      </ul>
    </AppCard>
    <LabelDialog v-model:open="dialogOpen" :label="editing" />
  </div>
</template>
