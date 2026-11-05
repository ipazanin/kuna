<script setup lang="ts">
import CategoriesCard from '../../categories/presentation/CategoriesCard.vue'
import { words as screenWords } from '../../screenWords'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import SpendingBooksCard from './SpendingBooksCard.vue'
import { words } from './words'
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.settings" :description="words.description" />
    <CategoriesCard />
    <SpendingBooksCard />
  </section>
</template>
