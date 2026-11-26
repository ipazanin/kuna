<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../shared/ui/AppCard.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../shared/ui/DrillLink.vue'
import EmptyState from '../../shared/ui/EmptyState.vue'
import GallerySection from './GallerySection.vue'
</script>

<template>
  <GallerySection
    id="empty-state"
    title="EmptyState"
    description="In place of what a screen has nothing of yet, dashed, or of what could not be worked out, with an error edge. With line, the one quiet sentence an empty list shows in its card."
  >
    <DashboardGrid>
      <EmptyState
        icon="i-lucide-search-x"
        title="No transactions match these filters"
        description="Clear a filter or pick a longer period."
        :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline' }]"
      />
      <EmptyState
        icon="i-lucide-triangle-alert"
        title="The file on Drive could not be read"
        description="Drive answered 404: File not found. Find the file again or open another."
        :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline' }]"
        tone="error"
      />
      <EmptyState icon="i-lucide-landmark" title="No loans yet" description="Your Loans file is ready. Add a bank loan from its contract, or an informal loan between people." />
      <EmptyState icon="i-lucide-calendar-clock" title="No plan rows yet">
        <template #description>A description with <span class="identifier">code</span> in it comes through its slot.</template>
        <template #actions>
          <UButton label="Add the first row" icon="i-lucide-plus" />
        </template>
      </EmptyState>
    </DashboardGrid>
    <DashboardGrid class="mt-4">
      <AppCard title="Loan changes" subtitle="Each change to the rate or the instalment, from the day it applies">
        <EmptyState line title="No change on file. The loan runs on the terms it started with." />
      </AppCard>
      <AppCard title="Plan rows" subtitle="What you plan to invoice each month">
        <EmptyState line>
          No rows in 2026 yet. <DrillLink :to="{ path: '/gallery', hash: '#empty-state' }" in-prose class="text-highlighted">Set the client's terms</DrillLink>, then fill the year or add a row.
        </EmptyState>
      </AppCard>
    </DashboardGrid>
  </GallerySection>
</template>
