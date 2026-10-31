<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import { usePhoneLayout } from '../../../../../../shared/layout/viewport'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import type { PersonRow } from './salariesView'
import { words } from './words'

/** Everyone paid on the payday with their total: a table on a wide screen, a card per person on a phone. A name opens that person's month. */
defineProps<{
  rows: { readonly people: readonly PersonRow[]; readonly total: PersonRow }
  /** The payday, such as "Sep 2026". */
  label: string
  payday: string
  /** The Month tab on a payday for one employee. */
  monthLink: (payday: string, slug: string) => RouteLocationRaw
}>()

const phone = usePhoneLayout()
</script>

<template>
  <AppCard :title="words.people.title(label)" :subtitle="words.people.subtitle" data-testid="salaries-people">
    <p v-if="rows.people.length === 0" class="px-4 py-6 text-sm text-muted sm:px-5">{{ words.people.noOne(label) }}</p>
    <ul v-else-if="phone" class="flex flex-col gap-2 px-4 pt-3 pb-4">
      <li v-for="person in [...rows.people, rows.total]" :key="person.slug" class="person-card" :data-person="person.slug">
        <p class="text-sm font-medium text-highlighted">
          <DrillLink v-if="person.slug !== 'total'" :to="monthLink(payday, person.slug)" :label="words.people.openMonth(person.name)">{{ person.name }}</DrillLink>
          <span v-else>{{ person.name }}</span>
        </p>
        <dl class="person-cells">
          <div>
            <dt>{{ words.people.gross }}</dt>
            <dd><MoneyText :cents="person.gross" /></dd>
          </div>
          <div>
            <dt>{{ words.people.net }}</dt>
            <dd><MoneyText :cents="person.net" /></dd>
          </div>
          <div>
            <dt>{{ words.people.pensionSavings }}</dt>
            <dd><MoneyText :cents="person.pensionSavings" /></dd>
          </div>
          <div>
            <dt>{{ words.people.toState }}</dt>
            <dd><MoneyText :cents="person.toState" /></dd>
          </div>
          <div>
            <dt>{{ words.people.cost }}</dt>
            <dd><MoneyText :cents="person.cost" /></dd>
          </div>
          <div>
            <dt>{{ words.people.problems }}</dt>
            <dd class="figure" :class="person.problems === 0 ? 'text-muted' : 'text-error'">{{ person.problems }}</dd>
          </div>
        </dl>
      </li>
    </ul>
    <FigureTable v-else class="px-1 pb-2 sm:px-2">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.people.name }}</th>
          <th scope="col" class="text-end">{{ words.people.gross }}</th>
          <th scope="col" class="text-end">{{ words.people.net }}</th>
          <th scope="col" class="hidden text-end @3xl:table-cell">{{ words.people.pensionSavings }}</th>
          <th scope="col" class="hidden text-end @xl:table-cell">{{ words.people.toState }}</th>
          <th scope="col" class="text-end">{{ words.people.cost }}</th>
          <th scope="col" class="w-20 text-end">{{ words.people.problems }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="person in [...rows.people, rows.total]" :key="person.slug" :data-person="person.slug" :class="{ 'font-medium': person.slug === 'total' }">
          <th scope="row" class="text-start font-normal">
            <DrillLink v-if="person.slug !== 'total'" :to="monthLink(payday, person.slug)" :label="words.people.openMonth(person.name)" class="text-highlighted">{{ person.name }}</DrillLink>
            <span v-else class="font-medium text-highlighted">{{ person.name }}</span>
          </th>
          <td class="text-end"><MoneyText :cents="person.gross" /></td>
          <td class="text-end"><MoneyText :cents="person.net" /></td>
          <td class="hidden text-end @3xl:table-cell"><MoneyText :cents="person.pensionSavings" /></td>
          <td class="hidden text-end @xl:table-cell"><MoneyText :cents="person.toState" /></td>
          <td class="text-end"><MoneyText :cents="person.cost" /></td>
          <td class="figure text-end" :class="person.problems === 0 ? 'text-muted' : 'text-error'">{{ person.problems }}</td>
        </tr>
      </tbody>
    </FigureTable>
  </AppCard>
</template>

<style scoped>
.person-card {
  padding: 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
}

.person-cells {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.person-cells dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.person-cells dd {
  font-size: 0.875rem;
  color: var(--ink);
}
</style>
