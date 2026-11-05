<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { formatAccountMoney } from '../../accounts/presentation/accountMoney'
import { euroLine } from '../../accounts/presentation/euroLine'
import { spendingHubFigures } from '../../home/presentation/spendingHubFigures'
import { words as homeWords } from '../../home/presentation/words'
import { countedAccounts, unconvertedCount } from '../../rates/domain/euroRows'
import { ratesIn } from '../../rates/domain/ratesState'
import type { RatesState } from '../../rates/domain/ratesState'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { SPENDING_ACCOUNTS_ROUTE, accountLink } from './spendingLinks'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'

/** The accounts Bank and cash counts, the open ones and a closed one that still holds money, with their balances today, each in its own currency, a foreign one in euros beside it, and what they hold together. */
const props = defineProps<{
  book: Pick<SpendingBook, 'accounts' | 'transactions'>
  rates: RatesState
  day: CivilDate
}>()

const counted = computed(() => countedAccounts(props.book, props.day, ratesIn(props.rates)))
const rows = computed(() => counted.value.map((entry) => ({ ...entry, euro: euroLine(entry, props.rates, props.day) })))

const totals = computed(() => {
  const figures = spendingHubFigures(props.book, props.rates, props.day)
  return figures === null || figures === 'opening' ? [] : figures.parts
})

const notConverted = computed(() => {
  const count = props.rates === 'loading' ? 0 : unconvertedCount(counted.value)
  return count === 0 ? null : plural(homeWords.notConverted(count), count)
})
</script>

<template>
  <AppCard :title="words.accounts.title" data-testid="spending-accounts">
    <FigureTable class="mt-2 px-1 sm:px-2" :label="words.accounts.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.accounts.account }}</th>
          <th scope="col" class="text-end">{{ words.accounts.balance }}</th>
          <th scope="col" class="text-end">{{ words.accounts.inEuros }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.account.id" data-testid="spending-account-row">
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink :to="accountLink(row.account)" class="text-highlighted">{{ row.account.name }}</DrillLink>
            <span v-if="row.euro !== null && row.euro.euros !== ''" class="block type-caption" data-testid="spending-account-rate">{{ row.euro.caption }}</span>
          </th>
          <td class="figure text-end">{{ formatAccountMoney(row.balance, row.account.currency) }}</td>
          <td class="figure cell-wraps text-end">
            <template v-if="row.euro !== null">
              <span v-if="rates === 'loading'" class="type-caption" data-testid="spending-account-waiting">{{ row.euro.caption }}</span>
              <span v-else-if="row.euro.euros === ''" class="text-muted">–</span>
              <template v-else>{{ row.euro.euros }}</template>
            </template>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="totals.length > 0">
        <tr v-for="part in totals" :key="part.label" data-testid="spending-accounts-total">
          <th scope="row" colspan="2" class="text-start">{{ part.label }}</th>
          <td class="figure text-end">{{ formatMoney(part.cents) }}</td>
        </tr>
      </tfoot>
    </FigureTable>
    <p v-if="notConverted !== null" class="px-4 pt-2 type-caption sm:px-5" data-testid="spending-accounts-not-converted">{{ notConverted }}</p>
    <div class="mt-auto px-4 pt-2 pb-4 sm:px-5">
      <UButton
        :to="SPENDING_ACCOUNTS_ROUTE"
        :label="words.accounts.allAccounts"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        variant="link"
        class="px-0"
        data-testid="spending-accounts-open"
      />
    </div>
  </AppCard>
</template>
