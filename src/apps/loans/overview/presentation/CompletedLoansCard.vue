<script setup lang="ts">
import type { CompletedLoan } from './loansOverview'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'

/** The loans at zero, below the open ones and collapsed until opened, each a row that opens its page. */
defineProps<{
  loans: readonly CompletedLoan[]
}>()
</script>

<template>
  <AppCard
    :title="words.completed.title"
    :subtitle="words.completed.subtitle"
    collapse-id="loans.completed"
    start-collapsed
    :summary="plural(words.completed.count(loans.length), loans.length)"
    data-testid="loans-completed"
  >
    <ul class="flex flex-col pt-2 pb-2">
      <li v-for="loan in loans" :key="loan.key" class="border-t border-default first:border-t-0">
        <ProposalRow :to="loan.to" :title="loan.name" :caption="[loan.look.label, loan.with].filter((part) => part !== '').join(' · ')" data-testid="completed-loan">
          <template #amount
            ><span class="type-caption">{{ loan.closed }}</span></template
          >
        </ProposalRow>
      </li>
    </ul>
  </AppCard>
</template>
