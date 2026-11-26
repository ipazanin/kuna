<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { words } from './words'
import { keyOfPayee } from '../domain/payeeDetails'
import { payeeKey } from '../domain/payeeKey'
import type { PayeeTotals } from '../domain/payeeTotals'
import type { PayeePeriod } from '../domain/payeePeriod'
import { payeePageLink } from '../../overview/presentation/spendingLinks'
import type { Payee } from '../../workbook/domain/payee'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { normaliseIban } from '../../../../shared/text/fold'
import { groupedIban } from '../../../../shared/text/iban'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'

/** Every payee of the period from A to Z, each with their IBANs and opening their entries, found by any of their names or an IBAN. */
const props = defineProps<{
  totals: readonly PayeeTotals[]
  period: PayeePeriod
  /** The keys of the payees who are people. */
  people: ReadonlySet<string>
  /** The payees you keep details of, whose other names find them too. */
  payees: readonly Payee[]
}>()

const find = ref('')
const allShown = ref(false)
watch([find, () => props.period], () => (allShown.value = false))

const found = computed(() => {
  const name = payeeKey(find.value)
  const iban = normaliseIban(find.value)
  const namesOf = new Map(props.payees.map((payee) => [keyOfPayee(payee), payee.names.map(payeeKey)]))
  return props.totals.filter((payee) => name === '' || (namesOf.get(payee.key) ?? [payee.key]).some((held) => held.includes(name)) || (iban !== '' && payee.ibans.some((held) => held.includes(iban))))
})
const lines = computed(() =>
  (allShown.value ? found.value : found.value.slice(0, FIRST_SHOWN)).map((payee) => ({
    payee,
    caption: [...(props.people.has(payee.key) ? [words.person] : []), plural(words.entries(payee.rows), payee.rows), ...(payee.latest === null ? [] : [words.newest(dayLabel(payee.latest))])].join(
      ' · ',
    ),
    ibans: payee.ibans.map(groupedIban),
  })),
)
</script>

<template>
  <AppCard :title="words.all.title" :subtitle="totals.some((payee) => payee.ibans.length > 0) ? words.all.subtitle : undefined" data-testid="spending-payees-all">
    <template v-if="totals.length > 0" #header>
      <UInput v-model="find" icon="i-lucide-search" :placeholder="words.all.find" :aria-label="words.all.find" class="w-full max-w-sm" data-testid="spending-payees-find" />
    </template>
    <EmptyState v-if="totals.length === 0" line :title="words.all.none" data-testid="spending-payees-all-none" />
    <EmptyState v-else-if="lines.length === 0" line :title="words.all.unmatched" data-testid="spending-payees-all-unmatched" />
    <ul v-else class="flex flex-col py-2">
      <li v-for="line in lines" :key="line.payee.key" class="border-t border-default first:border-t-0">
        <ListRow :to="payeePageLink(line.payee.key, period)" :title="line.payee.name" :caption="line.caption" data-testid="spending-payees-all-row">
          <template v-if="line.ibans.length > 0" #details>
            <span v-for="iban in line.ibans" :key="iban" class="figure type-caption break-all" data-testid="spending-payee-iban">{{ iban }}</span>
          </template>
        </ListRow>
      </li>
    </ul>
    <ShowAllButton v-if="found.length > FIRST_SHOWN" v-model:expanded="allShown" :total="found.length" class="px-4 pb-4 sm:px-5" />
  </AppCard>
</template>
