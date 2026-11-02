<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { CompletedLoan } from './loansOverview'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import { TONE_TEXT } from '../../../../shared/ui/toneText'

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
        <RouterLink :to="loan.to" class="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-elevated sm:px-5" data-testid="completed-loan">
          <UIcon :name="loan.look.icon" class="size-4 shrink-0" :class="TONE_TEXT[loan.look.tone]" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-highlighted">{{ loan.name }}</span>
            <span class="block truncate text-xs text-muted">{{ [loan.look.label, loan.with].filter((part) => part !== '').join(' · ') }}</span>
          </span>
          <span class="text-end text-xs text-muted">{{ loan.closed }}</span>
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </AppCard>
</template>
