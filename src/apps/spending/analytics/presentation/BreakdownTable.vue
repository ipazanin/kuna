<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { words } from './words'
import type { BreakdownLine, Grouping, SpanBreakdown } from '../domain/spanBreakdown'
import { formatCount } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import RecordRow from '../../../../shared/ui/RecordRow.vue'

/**
 * Every line of a span's breakdown, a group of categories as a group row with its children indented under it, each row opening
 * the line's entries over the span. A line with no money received, spent or saved, such as a loan's principal or a move between
 * your accounts, is left out. The column headings name the direction, so the amounts stay in ink. Label lines can overlap, so
 * they have no total.
 */
const props = defineProps<{
  breakdown: SpanBreakdown
  grouping: Grouping
  linkOf: (line: BreakdownLine) => RouteLocationRaw | null
  /** The line under the title: the span, or what the rates leave out. */
  subtitle: string
}>()

const counts = (line: BreakdownLine): boolean => line.income !== 0 || line.spent !== 0 || line.saved !== 0
const rows = computed(() =>
  props.breakdown.lines.filter(counts).flatMap((line) => {
    const children = line.children.filter(counts)
    return [{ line, child: false, group: children.length > 0 }, ...children.map((child) => ({ line: child, child: true, group: false }))]
  }),
)
const savedShown = computed(() => rows.value.some(({ line }) => line.saved !== 0))
const nameOf = (line: BreakdownLine): string => (line.name === '' ? words.analysis.breakdown.noAccount : line.name)
const heading = words.analysis.breakdown.heading
</script>

<template>
  <AppCard :title="words.analysis.breakdown.tableTitles[grouping]" :subtitle="subtitle" data-testid="spending-analysis-table">
    <p v-if="rows.length === 0" class="px-4 pb-4 type-aside sm:px-5" data-testid="spending-analysis-nothing">{{ words.analysis.breakdown.nothing }}</p>
    <template v-else>
      <FigureTable class="px-1 pb-2 sm:px-2">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ heading.name }}</th>
            <th scope="col" class="hidden text-end @md:table-cell">{{ heading.entries }}</th>
            <th scope="col" class="text-end">{{ heading.received }}</th>
            <th scope="col" class="text-end">{{ heading.spent }}</th>
            <th v-if="savedShown" scope="col" class="hidden text-end @lg:table-cell">{{ heading.saved }}</th>
          </tr>
        </thead>
        <tbody>
          <RecordRow
            v-for="{ line, child, group } in rows"
            :key="`${child ? 'child' : 'line'}-${line.key}`"
            :to="linkOf(line)"
            :class="{ 'group-row': group }"
            :data-spent="line.spent"
            data-testid="spending-analysis-row"
          >
            <th scope="row" class="cell-wraps text-start" :class="child ? 'font-normal' : 'font-medium'">
              <span class="block" :class="{ 'ps-5': child }">
                <DrillLink :to="linkOf(line)" :label="words.analysis.breakdown.openEntries(nameOf(line))" class="text-highlighted">{{ nameOf(line) }}</DrillLink>
              </span>
            </th>
            <td class="figure hidden text-end text-muted @md:table-cell">{{ formatCount(line.rows) }}</td>
            <td class="text-end"><MoneyText v-if="line.income !== 0" :cents="line.income" /><span v-else class="text-muted">–</span></td>
            <td class="text-end"><MoneyText v-if="line.spent !== 0" :cents="line.spent" /><span v-else class="text-muted">–</span></td>
            <td v-if="savedShown" class="hidden text-end @lg:table-cell"><MoneyText v-if="line.saved !== 0" :cents="line.saved" /><span v-else class="text-muted">–</span></td>
          </RecordRow>
        </tbody>
        <tfoot v-if="grouping !== 'label'">
          <tr>
            <th scope="row" class="text-start">{{ words.analysis.breakdown.total }}</th>
            <td class="hidden @md:table-cell" />
            <td class="text-end"><MoneyText v-if="breakdown.total.income !== 0" :cents="breakdown.total.income" /><span v-else class="text-muted">–</span></td>
            <td class="text-end"><MoneyText v-if="breakdown.total.spent !== 0" :cents="breakdown.total.spent" /><span v-else class="text-muted">–</span></td>
            <td v-if="savedShown" class="hidden text-end @lg:table-cell"><MoneyText v-if="breakdown.total.saved !== 0" :cents="breakdown.total.saved" /><span v-else class="text-muted">–</span></td>
          </tr>
        </tfoot>
      </FigureTable>
      <NoteLine v-if="grouping === 'label'" class="px-4 pb-4 sm:px-5" data-testid="spending-analysis-labels-overlap">{{ words.analysis.breakdown.labelsOverlap }}</NoteLine>
    </template>
  </AppCard>
</template>
