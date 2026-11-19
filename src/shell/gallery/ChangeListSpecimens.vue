<script setup lang="ts">
import ChangeListCard from '../../shared/ui/ChangeListCard.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import GallerySection from './GallerySection.vue'
</script>

<template>
  <GallerySection
    id="change-list-card"
    title="ChangeListCard"
    description="One kind of dated change to a record, such as a loan's rate periods or your part of a flat, each with Change, or Delete where it is only removed, and Add in the header."
  >
    <DashboardGrid layout="pair">
      <ChangeListCard
        title="Your part"
        subtitle="Your part from the day it was bought, and each change after it."
        :lines="[
          { key: 'start', title: '50%', detail: 'From the start, 4 May 2020' },
          { key: 'bought-out', title: '100%', detail: 'From 1 Mar 2026. Bought out the other owner' },
        ]"
        empty="No change yet."
        add-label="Add a change"
        collapse-id="gallery.change-list"
      />
      <ChangeListCard
        title="Saved tries"
        subtitle="Records that are only removed show Delete, and a card with nothing to add has no Add."
        :lines="[{ key: 'try', title: 'Pay 5,000 more in June', detail: 'Saves 1,240 of interest', removable: true }]"
        empty="Nothing saved yet."
        :can-add="false"
        collapse-id="gallery.change-list-removable"
      />
      <ChangeListCard
        title="Valuations"
        subtitle="With no records yet, the card says so under its subtitle."
        :lines="[]"
        empty="No valuation yet. The price paid counts until one is added."
        add-label="Add a valuation"
        collapse-id="gallery.change-list-empty"
      />
    </DashboardGrid>
  </GallerySection>
</template>
