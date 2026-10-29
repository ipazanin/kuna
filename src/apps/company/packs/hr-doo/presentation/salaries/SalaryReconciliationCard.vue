<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { usePhoneLayout } from '../../../../../../shared/layout/viewport'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import BuildUpButton from '../BuildUpButton.vue'
import type { FigureDetail } from '../tracedFigureView'
import type { SalaryMonthView } from './salariesView'

/**
 * Every line of the payday as the app and the bank state it: a table on a wide screen,
 * a card per line on a phone, collapsed while every line agrees and open while one differs. A line
 * only one source states has no verdict. An app figure opens how it is worked out, a bank figure its
 * rows.
 */
const props = defineProps<{
  view: SalaryMonthView
}>()

defineEmits<{
  open: [detail: FigureDetail]
}>()

const route = useRoute()
const phone = usePhoneLayout()

const allAgree = computed(() => props.view.agreeing === props.view.compared)
</script>

<template>
  <AppCard
    id="salary-reconciliation"
    title="App and bank"
    :subtitle="`Paid in ${view.label}. Each line from the app’s payroll and the bank rows. A dash is a line that source does not state.`"
    collapse-id="salaries.reconciliation"
    :summary="`${view.agreeing} of ${view.compared} lines agree`"
    :start-collapsed="allAgree"
    :reveal="!allAgree || route.hash === '#salary-reconciliation'"
    data-testid="salaries-reconciliation"
  >
    <div class="flex flex-col gap-5 px-4 pt-3 pb-4 sm:px-3">
      <section v-for="section in view.sections" :key="section.key" :aria-label="section.title" :data-section="section.key" class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-highlighted sm:px-2">{{ section.title }}</h3>
        <ul v-if="phone" class="flex flex-col">
          <li v-for="line in section.lines" :key="line.key" class="line-card" :data-verdict="line.verdict">
            <p class="flex items-center justify-between gap-2 text-sm">
              <span class="text-toned">{{ line.label }}</span>
              <span v-if="line.verdict === 'agrees'" class="inline-flex items-center gap-1 text-xs text-muted"><UIcon name="i-lucide-check" class="size-3.5" aria-hidden="true" />Agrees</span>
              <span v-else-if="line.verdict === 'differs'" class="inline-flex items-center gap-1 text-xs text-error"
                ><UIcon name="i-lucide-circle-alert" class="size-3.5" aria-hidden="true" />Differs</span
              >
            </p>
            <dl class="line-cells">
              <div>
                <dt>App</dt>
                <dd>
                  <BuildUpButton v-if="line.app" :cents="line.app.cents" :label="`${section.title}, ${line.label.toLowerCase()} by the app`" @open="$emit('open', line.app)" />
                  <span v-else class="text-muted">–</span>
                </dd>
              </div>
              <div>
                <dt>Bank</dt>
                <dd>
                  <DrillLink v-if="line.bank" :to="line.bank.to" :label="`${section.title}, ${line.label.toLowerCase()}, open the rows`"><MoneyText :cents="line.bank.cents" /></DrillLink>
                  <span v-else class="text-muted">–</span>
                </dd>
              </div>
            </dl>
          </li>
        </ul>
        <div v-else class="@container">
          <table class="data-table w-full text-sm">
            <thead>
              <tr>
                <th scope="col" class="text-start">Line</th>
                <th scope="col" class="w-28 text-end">App</th>
                <th scope="col" class="w-28 text-end">Bank</th>
                <th scope="col" class="w-24 text-start"><span class="sr-only">Verdict</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in section.lines" :key="line.key" :data-verdict="line.verdict">
                <th scope="row" class="text-start font-normal text-toned">{{ line.label }}</th>
                <td class="text-end">
                  <BuildUpButton v-if="line.app" :cents="line.app.cents" :label="`${section.title}, ${line.label.toLowerCase()} by the app`" @open="$emit('open', line.app)" />
                  <span v-else class="text-muted">–</span>
                </td>
                <td class="text-end">
                  <DrillLink v-if="line.bank" :to="line.bank.to" :label="`${section.title}, ${line.label.toLowerCase()}, open the rows`"><MoneyText :cents="line.bank.cents" /></DrillLink>
                  <span v-else class="text-muted">–</span>
                </td>
                <td>
                  <span v-if="line.verdict === 'agrees'" class="inline-flex items-center gap-1 text-xs text-muted"><UIcon name="i-lucide-check" class="size-3.5" aria-hidden="true" />Agrees</span>
                  <span v-else-if="line.verdict === 'differs'" class="inline-flex items-center gap-1 text-xs text-error"
                    ><UIcon name="i-lucide-circle-alert" class="size-3.5" aria-hidden="true" />Differs</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </AppCard>
</template>

<style scoped>
.line-card {
  padding-block: 0.5rem;
  border-bottom: 1px solid var(--border-default);
}

.line-card:last-child {
  border-bottom: 0;
}

.line-cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.line-cells dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.line-cells dd {
  font-size: 0.875rem;
  color: var(--ink);
}
</style>
