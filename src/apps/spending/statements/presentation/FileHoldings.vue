<script setup lang="ts">
import { words } from './words'
import type { FileHolding } from '../domain/fileHoldings'
import type { Account } from '../../workbook/domain/account'
import { plural } from '../../../../shared/text/translation'
import ListRow from '../../../../shared/ui/ListRow.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** What a statement file holds of each product and currency, before what importing it would do: its rows, their days, and the account they go to. */
const props = defineProps<{ holdings: readonly FileHolding[]; accounts: readonly Pick<Account, 'id' | 'name'>[] }>()

function accountName(holding: FileHolding): string | null {
  return holding.account === null ? null : (props.accounts.find((account) => account.id === holding.account)?.name ?? null)
}
</script>

<template>
  <section class="flex flex-col gap-1" data-testid="spending-import-holdings">
    <h3 class="type-label">{{ words.import.holdings.title }}</h3>
    <ul class="flex flex-col divide-y divide-default">
      <ListRow
        v-for="holding in holdings"
        :key="`${holding.savings} ${holding.currency}`"
        :title="words.import.holdings.product(holding.savings, holding.currency)"
        :caption="plural(words.import.holdings.rows(holding.rows, holding.first, holding.last), holding.rows)"
        flush
        data-testid="spending-import-holding"
      >
        <template #details>
          <span v-if="accountName(holding) !== null" class="type-caption">{{ words.import.holdings.goesTo(accountName(holding)!) }}</span>
          <NoteLine v-else tone="warning" size="caption" as="span">{{ words.import.holdings.noAccount }}</NoteLine>
        </template>
      </ListRow>
    </ul>
  </section>
</template>
