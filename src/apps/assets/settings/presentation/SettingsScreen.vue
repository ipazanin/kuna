<script setup lang="ts">
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import AssetsBooksCard from './AssetsBooksCard.vue'
import { words } from './words'
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <AssetsBooksCard />
  </section>
</template>
