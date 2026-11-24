<script setup lang="ts">
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import CategoriesCard from '../../categories/presentation/CategoriesCard.vue'
import CategoriesToSortCard from '../../categories/presentation/CategoriesToSortCard.vue'
import LabelsCard from '../../labels/presentation/LabelsCard.vue'
import RulesSection from '../../rules/presentation/RulesSection.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import { words } from './words'

/** Categories to sort while something waits, then categories, labels and the rules that file under them, each card with an anchor an old address lands on. */
const { state } = useWorkbook()
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <ItemsMoveNotice />
    <ScreenSkeleton v-if="state.workbook === null && state.status === 'opening'" :heading="false" :cards="3" data-testid="company-sorting-loading" />
    <template v-else-if="state.workbook !== null">
      <CategoriesToSortCard />
      <CategoriesCard />
      <LabelsCard />
      <RulesSection />
    </template>
  </section>
</template>
