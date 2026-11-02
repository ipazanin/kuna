<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { PricesFetchRun } from '../application/pricesUpdate'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { dateFormat } from '../../../../shared/calendar/dateFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import { failureLines } from './failureLines'
import PricesProgress from './PricesProgress.vue'
import { runProblem } from './runProblem'
import { usePrices } from './usePrices'
import { words } from './words'

/** The Prices tab's last fetch: when it ran, what it asked for and left, what it got nothing for and what to do, and Fetch now. */
const prices = usePrices()
const { state: books } = useInvestmentsBooks()
const toast = useToast()

const stamp = dateFormat({ dateStyle: 'medium', timeStyle: 'short' })
const file = computed(() => prices.state.copy?.file ?? null)
const lastFetch = computed(() => (file.value?.writtenAt == null ? words.neverFetched : stamp(new Date(file.value.writtenAt))))
const counts = computed(() => (file.value?.lastFetch == null ? null : words.lastCounts(file.value.lastFetch.asked, file.value.lastFetch.upToDate)))
const factCounts = computed(() => {
  const last = file.value?.lastFetch
  if (last == null || last.factsAsked + last.factsLeft === 0) return null
  const left = last.factsLeft === 0 ? '' : ` ${plural(words.factsLeft(last.factsLeft), last.factsLeft)}`
  return `${plural(words.lastFacts(last.factsAsked), last.factsAsked)}${left}`
})
const problem = computed(() => runProblem(prices.state.lastRun))
const failures = computed(() => failureLines(file.value?.failures ?? [], books.workbook?.book ?? null, PRICE_VENDORS))

function announce(run: PricesFetchRun | 'running' | 'no-books'): void {
  if (run === 'no-books') return
  if (run === 'running') {
    toast.add({ title: words.run.running, description: words.run.runningNote, icon: 'i-lucide-info', color: 'info' })
  } else if (run.kind === 'written') {
    const missed = run.file.failures.length
    toast.add({
      title: words.run.written,
      description: missed === 0 ? words.run.allFetched : plural(words.failures.title(missed), missed),
      icon: missed === 0 ? 'i-lucide-check' : 'i-lucide-triangle-alert',
      color: missed === 0 ? 'success' : 'warning',
    })
  } else if (run.kind === 'busy') {
    toast.add({ title: words.run.busy, description: words.run.busyNote, icon: 'i-lucide-info', color: 'info' })
  } else if (run.kind === 'current') {
    toast.add({ title: words.run.current, description: words.run.currentNote, icon: 'i-lucide-info', color: 'info' })
  } else {
    toast.add({ title: words.run.failed, description: runProblem(run) ?? '', icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  }
}

async function fetchNow(): Promise<void> {
  announce(await prices.fetchNow())
}
</script>

<template>
  <AppCard :title="words.lastFetchTitle" :subtitle="words.lastFetchSubtitle" data-testid="investments-last-fetch-card">
    <div class="flex flex-col gap-6 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <div class="flex flex-col gap-3" data-testid="prices-last-fetch">
        <PricesProgress v-if="prices.state.fetching !== null" :fetching="prices.state.fetching" />
        <UAlert v-if="problem !== null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.run.failed" :description="problem" data-testid="prices-run-problem" />
        <div class="flex flex-col gap-0.5">
          <dl class="flex flex-wrap gap-x-2 type-caption">
            <dt>{{ words.lastFetched }}</dt>
            <dd class="figure">{{ lastFetch }}</dd>
          </dl>
          <p v-if="counts !== null" class="type-caption" data-testid="prices-last-counts">{{ counts }}</p>
          <p v-if="factCounts !== null" class="type-caption" data-testid="prices-last-facts">{{ factCounts }}</p>
        </div>
        <div>
          <UButton
            icon="i-lucide-refresh-cw"
            :label="words.fetchNow"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="prices.state.fetching !== null"
            :disabled="prices.state.fetching !== null || books.workbook === null"
            data-testid="prices-fetch-now"
            @click="fetchNow"
          />
        </div>
      </div>

      <div v-if="failures.length > 0" class="flex flex-col gap-2" data-testid="prices-failures">
        <h3 class="type-label">{{ plural(words.failures.title(failures.length), failures.length) }}</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="line in failures" :key="line.series" class="flex flex-col">
            <span class="type-body text-highlighted">{{ line.what }}</span>
            <span class="type-caption">
              {{ line.why }} {{ line.advice }}
              <UButton v-if="line.link !== null" :to="line.link.to" :label="line.link.label" color="neutral" variant="link" size="sm" class="inline-target px-0" data-testid="prices-failure-link" />
            </span>
          </li>
        </ul>
      </div>
    </div>
  </AppCard>
</template>
