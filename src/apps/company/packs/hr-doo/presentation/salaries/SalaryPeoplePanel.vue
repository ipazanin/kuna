<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import { usePhoneLayout } from '../../../../../../shared/layout/viewport'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import ListRow from '../../../../../../shared/ui/ListRow.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import RecordRow from '../../../../../../shared/ui/RecordRow.vue'
import type { PersonRow } from './salariesView'
import { words } from './words'
import EmptyState from '../../../../../../shared/ui/EmptyState.vue'

/** Everyone paid on the payday with their total: a table on a wide screen, a card per person on a phone. A person's row opens their month. */
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
    <EmptyState v-if="rows.people.length === 0" line :title="words.people.noOne(label)" />
    <ul v-else-if="phone" class="row-list flex flex-col py-2">
      <li v-for="person in [...rows.people, rows.total]" :key="person.slug" class="border-t border-default first:border-t-0" :data-person="person.slug">
        <ListRow v-bind="person.slug === 'total' ? { as: 'div' } : { to: monthLink(payday, person.slug) }" :title="person.name" :class="{ 'font-medium': person.slug === 'total' }">
          <template #details>
            <dl class="grid grid-cols-3 gap-2">
              <div>
                <dt class="type-caption">{{ words.people.gross }}</dt>
                <dd><MoneyText :cents="person.gross" /></dd>
              </div>
              <div>
                <dt class="type-caption">{{ words.people.net }}</dt>
                <dd><MoneyText :cents="person.net" /></dd>
              </div>
              <div>
                <dt class="type-caption">{{ words.people.pensionSavings }}</dt>
                <dd><MoneyText :cents="person.pensionSavings" /></dd>
              </div>
              <div>
                <dt class="type-caption">{{ words.people.toState }}</dt>
                <dd><MoneyText :cents="person.toState" /></dd>
              </div>
              <div>
                <dt class="type-caption">{{ words.people.cost }}</dt>
                <dd><MoneyText :cents="person.cost" /></dd>
              </div>
              <div>
                <dt class="type-caption">{{ words.people.problems }}</dt>
                <dd class="figure" :class="person.problems === 0 ? 'type-aside' : 'type-body text-error'">{{ person.problems }}</dd>
              </div>
            </dl>
          </template>
        </ListRow>
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
        <RecordRow
          v-for="person in [...rows.people, rows.total]"
          :key="person.slug"
          :to="person.slug === 'total' ? null : monthLink(payday, person.slug)"
          :data-person="person.slug"
          :class="{ 'font-medium': person.slug === 'total' }"
        >
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
        </RecordRow>
      </tbody>
    </FigureTable>
  </AppCard>
</template>
