<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { CATEGORY_WRITES } from '../application/categoryWrites'
import { categoryTree, fixedCategories } from '../domain/categoryTree'
import { categoryColours } from './categoryColours'
import CategoryDialog from './CategoryDialog.vue'
import type { CategoryEditing } from './CategoryDialog.vue'
import { swappedPlaces } from './categoryPlaces'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isFixedKind } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import { words as spendingWords } from '../../words'
import { words } from './words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** The spending groups with their children, then Income, then the three fixed categories apart, each to edit, move, hide or delete. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const categories = computed(() => store.state.workbook?.categories ?? [])
const colourOf = computed(() => categoryColours(categories.value))

/** Each group with the groups of its kind beside it, the spending groups first, then Income. */
const sections = computed(() =>
  (['spending', 'income'] as const).flatMap((kind) => {
    const tree = categoryTree(categories.value, [kind])
    const groups = tree.map((entry) => entry.group)
    return tree.map((entry, place) => ({ ...entry, place, groups }))
  }),
)
const fixed = computed(() => fixedCategories(categories.value).flatMap((category) => (isFixedKind(category.kind) ? [{ category, kind: category.kind }] : [])))
const summary = computed(() => plural(words.count(categories.value.length), categories.value.length))

const editing = ref<CategoryEditing>({ mode: 'add-group' })
const dialogOpen = ref(false)

function openDialog(next: CategoryEditing): void {
  editing.value = next
  dialogOpen.value = true
}

async function move(siblings: readonly Category[], place: number, step: -1 | 1): Promise<void> {
  const changes = swappedPlaces(siblings, place, step)
  const moving = siblings[place]
  if (moving === undefined || changes.length === 0) return
  await writes.write(words.moved, (unit) => changes.forEach(([before, after]) => unit.of(CATEGORY_WRITES).change(before, after)), {
    key: `${step === -1 ? 'up' : 'down'}-${moving.id}`,
    failedTitle: spendingWords.form.notSaved,
    shownAtOnce: true,
  })
}
</script>

<template>
  <AppCard v-if="store.state.workbook !== null" :title="words.title" :subtitle="words.subtitle" collapse-id="spending-settings.categories" :summary="summary" data-testid="spending-categories">
    <template #actions>
      <UButton :label="words.addGroup" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="spending-add-group" @click="openDialog({ mode: 'add-group' })" />
    </template>
    <div class="flex flex-col pt-3 pb-2">
      <section v-for="section in sections" :key="section.group.id">
        <div class="group-row flex items-center gap-2 px-4 sm:px-5" data-testid="spending-category-row">
          <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: `var(${colourOf(section.group)})` }" aria-hidden="true" />
          <span class="min-w-0 flex-1 py-2 break-words" :class="{ 'text-muted': section.group.hidden }">{{ section.group.name }}</span>
          <UBadge v-if="section.group.hidden" :label="words.hidden" icon="i-lucide-eye-off" color="neutral" variant="subtle" size="sm" />
          <div class="flex shrink-0 items-center">
            <UButton
              icon="i-lucide-arrow-up"
              color="neutral"
              variant="ghost"
              class="size-11 justify-center"
              :aria-label="words.moveUp(section.group.name)"
              :disabled="section.place === 0"
              :loading="writes.saving(`up-${section.group.id}`)"
              data-testid="spending-category-up"
              @click="move(section.groups, section.place, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              color="neutral"
              variant="ghost"
              class="size-11 justify-center"
              :aria-label="words.moveDown(section.group.name)"
              :disabled="section.place === section.groups.length - 1"
              :loading="writes.saving(`down-${section.group.id}`)"
              data-testid="spending-category-down"
              @click="move(section.groups, section.place, 1)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              class="size-11 justify-center"
              :aria-label="words.edit(section.group.name)"
              data-testid="spending-category-edit"
              @click="openDialog({ mode: 'edit', category: section.group })"
            />
          </div>
        </div>
        <ul class="flex flex-col">
          <li v-for="(child, place) in section.children" :key="child.id" class="flex items-center gap-2 border-b border-default ps-8 pe-4 sm:ps-9 sm:pe-5" data-testid="spending-category-row">
            <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: `var(${colourOf(child)})` }" aria-hidden="true" />
            <span class="min-w-0 flex-1 py-2 text-sm break-words" :class="{ 'text-muted': child.hidden }">{{ child.name }}</span>
            <UBadge v-if="child.hidden" :label="words.hidden" icon="i-lucide-eye-off" color="neutral" variant="subtle" size="sm" />
            <div class="flex shrink-0 items-center">
              <UButton
                icon="i-lucide-arrow-up"
                color="neutral"
                variant="ghost"
                class="size-11 justify-center"
                :aria-label="words.moveUp(child.name)"
                :disabled="place === 0"
                :loading="writes.saving(`up-${child.id}`)"
                data-testid="spending-category-up"
                @click="move(section.children, place, -1)"
              />
              <UButton
                icon="i-lucide-arrow-down"
                color="neutral"
                variant="ghost"
                class="size-11 justify-center"
                :aria-label="words.moveDown(child.name)"
                :disabled="place === section.children.length - 1"
                :loading="writes.saving(`down-${child.id}`)"
                data-testid="spending-category-down"
                @click="move(section.children, place, 1)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                class="size-11 justify-center"
                :aria-label="words.edit(child.name)"
                data-testid="spending-category-edit"
                @click="openDialog({ mode: 'edit', category: child })"
              />
            </div>
          </li>
        </ul>
        <div class="ps-6 pe-4 pt-1 pb-3 sm:ps-7 sm:pe-5">
          <UButton
            :label="words.addChild"
            :aria-label="words.addChildTo(section.group.name)"
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            data-testid="spending-add-child"
            @click="openDialog({ mode: 'add-child', group: section.group })"
          />
        </div>
      </section>
      <section v-if="fixed.length > 0" data-testid="spending-fixed-categories">
        <h3 class="group-row px-4 py-2 sm:px-5">{{ words.fixedHeading }}</h3>
        <ul class="flex flex-col">
          <li v-for="{ category, kind } in fixed" :key="category.id" class="flex items-center gap-2 border-b border-default px-4 last:border-b-0 sm:px-5" data-testid="spending-category-row">
            <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: `var(${colourOf(category)})` }" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col py-2">
              <span class="text-sm break-words">{{ category.name }}</span>
              <span class="text-xs text-muted">{{ words.fixedCounts[kind] }}</span>
            </div>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              class="size-11 shrink-0 justify-center"
              :aria-label="words.edit(category.name)"
              data-testid="spending-category-edit"
              @click="openDialog({ mode: 'edit', category })"
            />
          </li>
        </ul>
      </section>
    </div>
    <CategoryDialog v-model:open="dialogOpen" :editing="editing" />
  </AppCard>
</template>
