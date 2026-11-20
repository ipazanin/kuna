<script setup lang="ts">
import { RouterLink } from 'vue-router'

import AppCard from '../../shared/ui/AppCard.vue'
import CutText from '../../shared/ui/CutText.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import GallerySection from './GallerySection.vue'
</script>

<template>
  <GallerySection
    id="cut-text"
    title="CutText"
    description="Text that may be cut short. While it is cut it shows its full text on hover, on keyboard focus and on a long press, and a text outside any control takes a tab stop. Short text shows nothing more. Inside a link the link's own focus shows it, and a tap opens the link."
  >
    <DashboardGrid>
      <AppCard title="One line">
        <dl class="flex max-w-56 flex-col gap-3 px-4 pb-4 sm:px-5" data-testid="cut-text-specimen">
          <div>
            <dt class="type-caption">Short, so nothing more</dt>
            <CutText as="dd" class="type-row-title">Rent</CutText>
          </div>
          <div>
            <dt class="type-caption">Cut, outside any control</dt>
            <CutText as="dd" class="type-row-title">Domain Software Solutions d.o.o., Zagreb</CutText>
          </div>
          <div>
            <dt class="type-caption">Cut, inside a link</dt>
            <dd>
              <RouterLink :to="{ path: '/gallery', hash: '#list-row' }" class="flex min-w-0 type-body underline underline-offset-3">
                <CutText class="min-w-0">Corner Market and Bakery on the Main Square</CutText>
              </RouterLink>
            </dd>
          </div>
        </dl>
      </AppCard>
      <AppCard title="Two lines">
        <div class="max-w-56 px-4 pb-4 sm:px-5">
          <CutText as="p" :lines="2" class="type-body">Monthly rent for the office on the second floor, with the shared kitchen and the parking space behind the building</CutText>
        </div>
      </AppCard>
    </DashboardGrid>
  </GallerySection>
</template>
