<script setup lang="ts">
import CategoriesCard from '../../categories/presentation/CategoriesCard.vue'
import { words as screenWords } from '../../screenWords'
import RulesCard from '../../statements/presentation/RulesCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import SpendingBooksCard from './SpendingBooksCard.vue'
import { words } from './words'

const TABS = [
  { value: 'general', label: words.tabs.general, icon: 'i-lucide-settings' },
  { value: 'rules', label: words.tabs.rules, icon: 'i-lucide-list-ordered' },
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
    </PageTabs>
  </section>
</template>
