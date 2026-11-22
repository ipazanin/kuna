<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { accountSources } from '../../imports/domain/accountIntake'
import { ibkrMailReader } from '../../mail/domain/ibkrFlexRecipe'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentAccount, InvestmentPeriod } from '../../workbook/domain/investmentAccount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import AccountDialog from './AccountDialog.vue'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import CutText from '../../../../shared/ui/CutText.vue'

/** The accounts of the Investments file, each with how its rows come in and its change, and a way to add one. */
const { state } = useInvestmentsBooks()
const accounts = computed(() => state.workbook?.book.accounts ?? [])
const sources = computed(() => (state.workbook === null ? new Map<RecordId, readonly InvestmentPeriod[]>() : accountSources(state.workbook.book)))
const readerOn = computed(() => ibkrMailReader(state.workbook?.book)?.on === true)

/** Where one period's rows come from, from its day. */
function periodLine(period: InvestmentPeriod): string {
  const from = period.from === null ? null : dayLabel(period.from)
  if (period.source === 'mail') return words.accounts.fromMail(from ?? '')
  if (period.source === 'provider-file') return from === null ? words.accounts.uploads : words.accounts.uploadsFrom(from)
  return from === null ? words.accounts.byHand : words.accounts.byHandFrom(from)
}

/** Where the account's rows come from, each period in order, and whether the mail's reader is off while the mail fills a period. */
function intakeLine(account: InvestmentAccount): string {
  const periods = sources.value.get(account.id) ?? []
  const mailed = periods.some((period) => period.source === 'mail')
  return [...periods.map(periodLine), ...(mailed && !readerOn.value ? [words.accounts.readerOff] : [])].join(', ')
}

const editing = ref<InvestmentAccount | null>(null)
const open = ref(false)

function openAccount(account: InvestmentAccount | null): void {
  editing.value = account
  open.value = true
}
</script>

<template>
  <AppCard v-if="state.workbook !== null" id="accounts" :title="words.accounts.title" :subtitle="words.accounts.subtitle" data-testid="investments-accounts">
    <ul v-if="accounts.length > 0" class="px-2 pb-1 sm:px-3">
      <li v-for="account in accounts" :key="account.id" class="flex items-center justify-between gap-3 border-t border-default py-1 ps-2 first:border-t-0" data-testid="investments-account">
        <span class="min-w-0">
          <CutText class="block type-row-title">{{ account.name }}</CutText>
          <CutText class="block type-caption" data-testid="investments-account-intake">{{ [intakeLine(account), account.note].filter((part) => part !== '').join(' · ') }}</CutText>
        </span>
        <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="words.accounts.change(account.name)" data-testid="account-edit" @click="openAccount(account)" />
      </li>
    </ul>
    <p v-else class="px-4 pb-2 type-body sm:px-5">{{ words.accounts.none }}</p>
    <div class="px-4 pb-4 sm:px-5">
      <UButton :label="words.accounts.add" icon="i-lucide-plus" color="neutral" variant="outline" data-testid="account-add" @click="openAccount(null)" />
    </div>
    <AccountDialog v-model:open="open" :account="editing" />
  </AppCard>
</template>
