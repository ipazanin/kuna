<script setup lang="ts">
import { ASSETS_ASSIST } from '../../assistant/assetsAssist'
import { assetsData } from '../../workbook/presentation/assetsData'
import AppAssistCard from '../../../../shared/ai/presentation/AppAssistCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import AssetsBooksCard from './AssetsBooksCard.vue'
import { words } from './words'
import { words as assetsWords } from '../../words'

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
        <AssetsBooksCard />
      </template>
      <template #assistant>
        <AppAssistCard :app="assetsData.id" :tasks="ASSETS_ASSIST.tasks()" :chat-reads="assetsWords.name" />
      </template>
    </PageTabs>
  </section>
</template>
