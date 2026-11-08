<script setup lang="ts">
import { LOANS_ASSIST } from '../../assistant/loansAssist'
import { loansData } from '../../workbook/presentation/loansData'
import AppAssistCard from '../../../../shared/ai/presentation/AppAssistCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import LoansBooksCard from './LoansBooksCard.vue'
import { words } from './words'
import { words as loansWords } from '../../words'

const TABS = [
  { value: 'general', label: words.tabs.general, icon: 'i-lucide-settings' },
  { value: 'assistant', label: words.tabs.assistant, icon: 'i-lucide-sparkles' },
]
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <PageTabs :tabs="TABS" :label="words.tabs.label">
      <template #general>
        <LoansBooksCard />
      </template>
      <template #assistant>
        <AppAssistCard :app="loansData.id" :tasks="LOANS_ASSIST.tasks()" :chat-reads="loansWords.name" />
      </template>
    </PageTabs>
  </section>
</template>
