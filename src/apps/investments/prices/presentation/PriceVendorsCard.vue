<script setup lang="ts">
import { computed, reactive } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { pricesDay } from '../application/pricesUpdate'
import type { PriceVendor } from '../application/priceVendor'
import { testVendor } from '../application/vendorTest'
import { storeVendorKey, storedVendorKey } from '../infrastructure/vendorKeys'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { listInWords } from '../../../../shared/text/listInWords'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { pageVendorFetch, useRequestsToday } from './usePrices'
import { useVendorKeys } from './useVendorKeys'
import { words } from './words'

/**
 * The Prices tab's vendors, one row each from the registry: what it covers and gives, its free limits and this
 * browser's requests today, its key in this browser with Save, Test and Remove, and where to claim a free key.
 */
const keys = useVendorKeys(PRICE_VENDORS, { read: storedVendorKey, write: storeVendorKey }, (vendor, key) => testVendor(vendor, pageVendorFetch, key, pricesDay(new Date().toISOString())))
const requestsToday = useRequestsToday()
/** What is typed in each key field, which goes nowhere until Save. */
const typed = reactive<Record<string, string>>(Object.fromEntries(PRICE_VENDORS.map((vendor) => [vendor.id, ''])))

function save(vendor: PriceVendor): void {
  if (keys.save(vendor.id, typed[vendor.id] ?? '')) typed[vendor.id] = ''
}

function offers(vendor: PriceVendor): string {
  const given = [vendor.prices === 'rates' ? words.capabilities.rates : words.capabilities.closes, ...(vendor.splits === undefined ? [] : [words.capabilities.splits])]
  return `${words.offers} ${listInWords(given)}.`
}

/** Each vendor's row: what it prices and allows, how its key stands, and what its last Test said. */
const vendorRows = computed(() =>
  PRICE_VENDORS.map((vendor) => {
    const { kept, ending, test } = keys.rows[vendor.id]!
    const tested = test === null || test === 'testing' ? null : test
    return {
      vendor,
      kept,
      offers: offers(vendor),
      limits: words.freeLimits(vendor.limits.perMinute, vendor.limits.perDay),
      usage: words.usedToday(requestsToday(vendor.id), vendor.limits.perDay),
      keyLine: !kept ? words.noKey : ending === null ? words.kept : words.keptEnding(ending),
      testing: test === 'testing',
      testWorks: tested?.kind === 'works',
      testLine: tested === null ? null : tested.kind === 'works' ? (vendor.needsKey ? words.works : words.answers) : words.testFailed[tested.reason](vendor.name),
    }
  }),
)
</script>

<template>
  <AppCard :title="words.vendors" :subtitle="words.card.subtitle" data-testid="investments-prices-card">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <div v-for="row in vendorRows" :key="row.vendor.id" class="flex flex-col gap-3 border-t border-default pt-3 first:border-t-0 first:pt-0" data-testid="price-vendor" :data-vendor="row.vendor.id">
        <div class="flex flex-col gap-0.5">
          <p class="type-body text-highlighted">{{ row.vendor.name }}</p>
          <p class="type-caption">{{ row.vendor.covers }}</p>
          <p class="type-caption" data-testid="price-vendor-offers">{{ row.offers }}</p>
          <p class="type-caption" data-testid="price-vendor-limits">{{ row.limits }}</p>
          <p class="type-caption" data-testid="price-vendor-usage">{{ row.usage }}</p>
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
    </div>
  </AppCard>
</template>
