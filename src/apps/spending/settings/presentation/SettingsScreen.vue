<script setup lang="ts">
import BankSyncCard from '../../bankSync/presentation/BankSyncCard.vue'
import CategoriesCard from '../../categories/presentation/CategoriesCard.vue'
import ReceiptsCard from '../../receipts/presentation/ReceiptsCard.vue'
import { words as screenWords } from '../../screenWords'
import RulesCard from '../../statements/presentation/RulesCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import SpendingBooksCard from './SpendingBooksCard.vue'
import { words } from './words'

const TABS = [
  { value: 'general', label: words.tabs.general, icon: 'i-lucide-settings' },
  { value: 'rules', label: words.tabs.rules, icon: 'i-lucide-list-ordered' },
  { value: 'bank-sync', label: words.tabs.bankSync, icon: 'i-lucide-landmark' },
  { value: 'receipts', label: words.tabs.receipts, icon: 'i-lucide-receipt' },
]
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.settings" :description="words.description" />
    <PageTabs :tabs="TABS" :label="words.tabs.label">
      <template #general>
        <div class="flex flex-col gap-6">
          <CategoriesCard />
          <SpendingBooksCard />
        </div>
      </template>
      <template #rules>
        <RulesCard />
      </template>
      <template #bank-sync>
        <BankSyncCard />
      </template>
      <template #receipts>
        <ReceiptsCard />
      </template>
    </PageTabs>
  </section>
</template>
