<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import AccountDialog from './AccountDialog.vue'
import { words } from './words'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** The accounts of the Investments file, each with its change, and a way to add one. */
const { state } = useInvestmentsBooks()
const accounts = computed(() => state.workbook?.book.accounts ?? [])

const editing = ref<InvestmentAccount | null>(null)
const open = ref(false)

function openAccount(account: InvestmentAccount | null): void {
  editing.value = account
  open.value = true
}
</script>

<template>
  <AppCard v-if="state.workbook !== null" :title="words.accounts.title" :subtitle="words.accounts.subtitle" data-testid="investments-accounts">
    <ul v-if="accounts.length > 0" class="px-2 pb-1 sm:px-3">
      <li v-for="account in accounts" :key="account.id" class="flex items-center justify-between gap-3 border-t border-default py-1 ps-2 first:border-t-0" data-testid="investments-account">
        <span class="min-w-0">
          <span class="block truncate type-body text-highlighted">{{ account.name }}</span>
          <span v-if="account.note !== ''" class="block truncate type-caption">{{ account.note }}</span>
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
