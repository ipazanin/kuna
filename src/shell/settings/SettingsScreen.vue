<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { useRoute } from 'vue-router'

import { LINKED_SETTINGS_TAB } from '../../shared/app/appContribution'
import type { AppSettings } from '../../shared/app/appContribution'
import PageHeader from '../../shared/ui/PageHeader.vue'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import PageTabs from '../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../shared/ui/PageTabs.vue'
import AppearanceCard from './AppearanceCard.vue'
import SyncCard from './SyncCard.vue'

const props = defineProps<{
  /** Each installed app's parts, the home app's first. */
  parts: readonly AppSettings[]
}>()

const DEVICE_TAB = 'device'

/** Every app's tabs in install order. Two tabs with one value would share a `?tab=` link, so they are refused. */
const appTabs = computed(() => {
  const found = props.parts.flatMap((part) => part.tabs())
  const values = [DEVICE_TAB, ...found.map((tab) => tab.value)]
  const repeated = values.find((value, index) => values.indexOf(value) !== index)
  if (repeated !== undefined) {
    throw new Error(`Two tabs of Settings are called ${repeated}.`)
  }
  return found
})
const tabs = computed((): PageTab[] => [
  ...appTabs.value.map(({ label, value, icon }) => ({ label, value, icon })),
  { label: 'This device', value: DEVICE_TAB, icon: 'i-lucide-monitor-smartphone' },
])
const deviceCards = computed(() => props.parts.flatMap((part) => part.deviceCards()))
const { groups } = usePageSync()
const someOnDrive = computed(() => groups.some((group) => group.store.state.choice?.source === 'drive'))

const route = useRoute()
const linkedTab = ref(typeof route.query.tab === 'string' ? route.query.tab : null)
provide(LINKED_SETTINGS_TAB, linkedTab)
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Settings" description="How each app's books and this device are set up. A save writes what you changed to the app's file, on Drive or in this browser, checks it reads back, and offers Undo." />

    <PageTabs :tabs="tabs" label="Parts of the settings" data-testid="settings-tabs" @select="linkedTab = null">
      <template v-for="tab in appTabs" :key="tab.value" #[tab.value]>
        <component :is="tab.component" />
      </template>

      <template #[DEVICE_TAB]>
        <div class="grid gap-4 lg:grid-cols-2">
          <component :is="card" v-for="(card, index) in deviceCards" :key="index" />
          <SyncCard v-if="someOnDrive" />
          <AppearanceCard />
        </div>
      </template>
    </PageTabs>
  </section>
</template>
