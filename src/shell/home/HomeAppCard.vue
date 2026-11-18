<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { AppContribution } from '../../shared/app/appContribution'
import AppCard from '../../shared/ui/AppCard.vue'
import AppMark from '../../shared/ui/AppMark.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import NoteLine from '../../shared/ui/NoteLine.vue'
import { entryPath } from '../routing/appRegistry'
import OpeningPlaceholder from '../ui/OpeningPlaceholder.vue'
import { words } from './words'
import CutText from '../../shared/ui/CutText.vue'

/**
 * One app on the home. Its name is the link, stretched over the card: into its first screen with its figures, or into
 * its first run, which it offers as Set up. The app's button, such as Fetch today, sits above the link.
 */
const props = defineProps<{
  app: AppContribution
}>()

const appAction = props.app.homeCard.useAction?.()
const action = computed(() => appAction?.value ?? null)

const setUp = computed(() => props.app.firstRun())
const figures = computed(() => (setUp.value ? null : props.app.homeCard.figures()))
const subtitle = computed(() => (setUp.value ? null : props.app.subtitle()))
const next = computed(() => (setUp.value ? undefined : props.app.setUpLines()[0]))
const to = computed(() => entryPath(props.app))
</script>

<template>
  <AppCard
    as="article"
    class="stretched-card gap-4 p-4 transition-colors hover:border-accented sm:p-5"
    :data-app="app.id"
    :data-state="setUp ? 'set-up' : 'open'"
    :aria-busy="figures === 'opening'"
    data-testid="home-card"
  >
    <div class="flex items-center gap-3">
      <AppMark :icon="app.homeCard.icon" :colour="app.colour" size="large" />
      <div class="min-w-0 flex-1">
        <h2 class="type-card-title">
          <RouterLink :to="to" class="stretched-link" data-testid="home-card-link">{{ app.name }}</RouterLink>
        </h2>
        <CutText v-if="subtitle" as="p" class="type-caption">{{ subtitle }}</CutText>
      </div>
      <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-muted" aria-hidden="true" />
    </div>

    <OpeningPlaceholder v-if="figures === 'opening'" data-testid="home-card-opening" />
    <p v-else-if="figures === 'failed'" class="type-body" data-testid="home-card-failed">{{ words.failed }}</p>
    <template v-else-if="figures !== null">
      <dl class="flex flex-wrap gap-x-8 gap-y-3">
        <div v-for="({ label, ...figure }, index) in figures.amounts" :key="label" class="flex flex-col gap-1">
          <dt class="type-label">{{ label }}</dt>
          <dd :class="index === 0 ? 'type-figure' : 'type-figure-secondary'">
            <MoneyText v-bind="figure" :format="app.moneyFormat()" />
          </dd>
        </div>
      </dl>
      <UBadge
        v-if="figures.waiting"
        :label="figures.waiting"
        icon="i-lucide-inbox"
        color="warning"
        variant="subtle"
        class="max-w-full self-start"
        :ui="{ label: 'whitespace-normal' }"
        data-testid="home-card-waiting"
      />
      <div v-if="action !== null" class="flex flex-col gap-2">
        <UButton
          :label="action.label"
          :icon="action.icon"
          :loading="action.busy"
          color="neutral"
          variant="outline"
          class="relative z-control self-start"
          data-testid="home-card-action"
          @click="action.run()"
        />
        <NoteLine v-if="action.note !== null" tone="warning" role="status" data-testid="home-card-action-note">{{ action.note }}</NoteLine>
      </div>
    </template>
    <template v-else>
      <p class="type-body">{{ app.homeCard.purpose }}</p>
      <UBadge v-if="setUp" :label="words.setUp" trailing-icon="i-lucide-arrow-right" color="primary" variant="solid" class="self-start" data-testid="home-card-set-up" />
    </template>
    <p v-if="next !== undefined && figures !== 'opening' && figures !== 'failed'" class="type-caption" data-testid="home-card-next">{{ words.next(next.text) }}</p>
  </AppCard>
</template>
