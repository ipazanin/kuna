<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { pricesDay } from '../application/pricesUpdate'
import type { PricesFetchRun } from '../application/pricesUpdate'
import type { PriceVendor } from '../application/priceVendor'
import { testVendor } from '../application/vendorTest'
import { storeVendorKey, storedVendorKey } from '../infrastructure/vendorKeys'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { dateFormat } from '../../../../shared/calendar/dateFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { failureLines } from './failureLines'
import { runProblem } from './runProblem'
import PricesProgress from './PricesProgress.vue'
import { pageVendorFetch, usePrices } from './usePrices'
import { useVendorKeys } from './useVendorKeys'
import { words } from './words'

/** Investments Settings, Prices: the last fetch and what it missed, Fetch now, and each vendor with what it prices and its key in this browser. */
const prices = usePrices()
const { state: books } = useInvestmentsBooks()
const toast = useToast()

const stamp = dateFormat({ dateStyle: 'medium', timeStyle: 'short' })
const writtenAt = computed(() => prices.state.copy?.file.writtenAt ?? null)
const lastFetch = computed(() => (writtenAt.value === null ? words.neverFetched : stamp(new Date(writtenAt.value))))
const problem = computed(() => runProblem(prices.state.lastRun))
const failures = computed(() => failureLines(prices.state.copy?.file.failures ?? [], books.workbook?.book ?? null, PRICE_VENDORS))

const keys = useVendorKeys(PRICE_VENDORS, { read: storedVendorKey, write: storeVendorKey }, (vendor, key) => testVendor(vendor, pageVendorFetch, key, pricesDay(new Date().toISOString())))
/** What is typed in each key field, which goes nowhere until Save. */
const typed = reactive<Record<string, string>>(Object.fromEntries(PRICE_VENDORS.map((vendor) => [vendor.id, ''])))

function save(vendor: PriceVendor): void {
  if (keys.save(vendor.id, typed[vendor.id] ?? '')) typed[vendor.id] = ''
}

/** Each vendor's row: what it prices, how its key stands, and what its last Test said. */
const vendorRows = computed(() =>
  PRICE_VENDORS.map((vendor) => {
    const { kept, ending, test } = keys.rows[vendor.id]!
    const tested = test === null || test === 'testing' ? null : test
    return {
      vendor,
      kept,
      keyLine: !kept ? words.noKey : ending === null ? words.kept : words.keptEnding(ending),
      testing: test === 'testing',
      testWorks: tested?.kind === 'works',
      testLine: tested === null ? null : tested.kind === 'works' ? (vendor.needsKey ? words.works : words.answers) : words.testFailed[tested.reason](vendor.name),
    }
  }),
)

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
  <AppCard id="prices" :title="words.card.title" :subtitle="words.card.subtitle" data-testid="investments-prices-card">
    <div class="flex flex-col gap-6 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <div class="flex flex-col gap-3" data-testid="prices-last-fetch">
        <PricesProgress v-if="prices.state.fetching !== null" :fetching="prices.state.fetching" />
        <UAlert v-if="problem !== null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.run.failed" :description="problem" data-testid="prices-run-problem" />
        <dl class="flex flex-wrap gap-x-2 type-caption">
          <dt>{{ words.lastFetched }}</dt>
          <dd class="figure">{{ lastFetch }}</dd>
        </dl>
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
            <span class="type-caption">{{ line.why }}</span>
          </li>
        </ul>
      </div>

      <section class="flex flex-col gap-3">
        <h3 class="type-label">{{ words.vendors }}</h3>
        <div v-for="row in vendorRows" :key="row.vendor.id" class="flex flex-col gap-3 border-t border-default pt-3" data-testid="price-vendor" :data-vendor="row.vendor.id">
          <div class="flex flex-col gap-0.5">
            <p class="type-body text-highlighted">{{ row.vendor.name }}</p>
            <p class="type-caption">{{ row.vendor.covers }}</p>
          </div>
          <template v-if="row.vendor.needsKey">
            <p class="type-caption" data-testid="price-vendor-kept">{{ row.keyLine }}</p>
            <FormGrid>
              <UFormField :label="words.key(row.vendor.name)">
                <UInput
                  v-model="typed[row.vendor.id]"
                  type="password"
                  autocomplete="off"
                  autocapitalize="off"
                  :spellcheck="false"
                  :placeholder="words.keyPlaceholder"
                  class="w-full"
                  data-testid="price-vendor-key"
                  @keydown.enter.prevent="save(row.vendor)"
                />
              </UFormField>
            </FormGrid>
          </template>
          <p v-else class="type-caption">{{ words.needsNoKey }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="row.vendor.needsKey"
              icon="i-lucide-key-round"
              :label="words.save"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="(typed[row.vendor.id] ?? '').trim() === ''"
              data-testid="price-vendor-save"
              @click="save(row.vendor)"
            />
            <UButton
              icon="i-lucide-plug-zap"
              :label="words.test"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="row.testing"
              :disabled="(row.vendor.needsKey && !row.kept) || row.testing"
              data-testid="price-vendor-test"
              @click="keys.test(row.vendor)"
            />
            <UButton
              v-if="row.vendor.needsKey && row.kept"
              icon="i-lucide-trash-2"
              :label="words.forget"
              color="neutral"
              variant="ghost"
              size="sm"
              data-testid="price-vendor-forget"
              @click="keys.forget(row.vendor.id)"
            />
            <UButton
              v-if="row.vendor.keyAddress !== null"
              :to="row.vendor.keyAddress"
              target="_blank"
              rel="noopener noreferrer"
              trailing-icon="i-lucide-external-link"
              :label="words.claim"
              color="neutral"
              variant="link"
              size="sm"
              data-testid="price-vendor-claim"
            />
          </div>
          <p v-if="row.testLine !== null" role="status" class="flex items-center gap-1.5 type-body" :class="row.testWorks ? 'text-success' : 'text-error'" data-testid="price-vendor-test-result">
            <UIcon :name="row.testWorks ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="size-4 shrink-0" aria-hidden="true" />
            {{ row.testLine }}
          </p>
        </div>
      </section>
    </div>
  </AppCard>
</template>
