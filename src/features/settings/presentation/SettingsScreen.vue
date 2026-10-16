<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { activeTheme, chooseTheme } from '../../../shared/theme/theme'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { BUCKETS } from '../../workbook/domain/bucket'
import { useWorkbook } from '../../workbook/application/workbookStore'

const { state, chooseAnotherSheet } = useWorkbook()

const stamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

const BUCKET_NOTES: Readonly<Record<(typeof BUCKETS)[number], string>> = {
  income: 'Counts as income',
  operating: 'Operating cost',
  taxes: 'Taxes and contributions',
  'owner-pay': 'Paid to the owner',
  financing: 'Outside profit and loss',
  neutral: 'Moves money between own pockets',
}

const sheetName = computed(() => state.sheet?.name ?? state.workbook?.title ?? null)
const syncedAt = computed(() => (state.syncedAt === null ? null : stamp.format(new Date(state.syncedAt))))

const categories = computed(() =>
  [...(state.workbook?.categories ?? [])].sort(
    (left, right) =>
      BUCKETS.indexOf(left.bucket) - BUCKETS.indexOf(right.bucket) ||
      left.family.localeCompare(right.family) ||
      left.slug.localeCompare(right.slug),
  ),
)
const accounts = computed(() => state.workbook?.accounts ?? [])

const darkTheme = computed({
  get: () => activeTheme.value === 'dark',
  set: (dark: boolean) => chooseTheme(dark ? 'dark' : 'light'),
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Settings" description="What the app reads from your Sheet. Edits happen in the Sheet for now." />

    <div class="grid items-start gap-4 lg:grid-cols-2">
      <section class="flex flex-col gap-3 rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
        <h2 class="text-sm font-medium text-highlighted">Connected Sheet</h2>
        <p v-if="sheetName" class="text-base text-highlighted">{{ sheetName }}</p>
        <p v-else class="text-sm text-muted">No Sheet chosen yet.</p>
        <p v-if="syncedAt" class="figure text-xs text-muted">Last synced {{ syncedAt }}</p>
        <div>
          <UButton
            icon="i-lucide-file-spreadsheet"
            :label="sheetName ? 'Choose another Sheet' : 'Choose your Sheet'"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="state.status === 'syncing'"
            :disabled="state.status === 'syncing'"
            @click="chooseAnotherSheet"
          />
        </div>
        <p class="text-xs text-muted">The copy of the current Sheet stays on screen until the new one is read.</p>
      </section>

      <section class="flex flex-col gap-3 rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
        <h2 class="text-sm font-medium text-highlighted">Appearance</h2>
        <USwitch v-model="darkTheme" label="Dark theme" description="Remembered on this device." />
      </section>
    </div>

    <section v-if="categories.length" class="rounded-card border border-default bg-raised shadow-raised">
      <header class="px-4 pt-4 sm:px-5">
        <h2 class="text-sm font-medium text-highlighted">Categories</h2>
        <p class="mt-0.5 text-xs text-muted">From the categories tab. The bucket decides where a row counts.</p>
      </header>
      <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th scope="col" class="text-start">Category</th>
              <th scope="col" class="text-start">Family</th>
              <th scope="col" class="text-start">Bucket</th>
              <th scope="col" class="hidden text-start sm:table-cell">Counts as</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="category in categories" :key="category.slug">
              <th scope="row" class="text-start font-normal text-highlighted">{{ category.slug }}</th>
              <td class="text-toned">{{ category.family }}</td>
              <td>
                <span class="inline-flex items-center gap-1.5 text-toned">
                  <span class="size-2 rounded-[2px]" :style="{ background: `var(--bucket-${category.bucket})` }" aria-hidden="true" />
                  {{ category.bucket }}
                </span>
              </td>
              <td class="hidden text-muted sm:table-cell">{{ BUCKET_NOTES[category.bucket] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="accounts.length" class="rounded-card border border-default bg-raised shadow-raised">
      <header class="px-4 pt-4 sm:px-5">
        <h2 class="text-sm font-medium text-highlighted">Accounts</h2>
      </header>
      <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th scope="col" class="text-start">Account</th>
              <th scope="col" class="text-start">IBAN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in accounts" :key="account.slug">
              <th scope="row" class="text-start font-normal text-highlighted">{{ account.slug }}</th>
              <td class="identifier text-toned">{{ account.iban || '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
