<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { AppContribution } from '../../shared/app/appContribution'
import AppCard from '../../shared/ui/AppCard.vue'
import AppMark from '../../shared/ui/AppMark.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import { words } from './words'

/** One app on the home, the whole card a link: into its first screen with its figures, or into its first run, which it offers as Set up. */
const props = defineProps<{
  app: AppContribution
}>()

const setUp = computed(() => props.app.firstRun())
const figures = computed(() => (setUp.value ? null : props.app.homeCard.figures()))
const subtitle = computed(() => (setUp.value ? null : props.app.subtitle()))
const to = computed(() => (setUp.value ? props.app.startPath : (props.app.screens[0]?.path ?? props.app.startPath)))
</script>

<template>
  <RouterLink v-slot="{ href, navigate }" :to="to" custom>
    <AppCard as="a" :href="href" class="gap-4 p-4 transition-colors hover:border-accented sm:p-5" :data-app="app.id" :data-state="setUp ? 'set-up' : 'open'" data-testid="home-card" @click="navigate">
      <div class="flex items-center gap-3">
        <AppMark :icon="app.homeCard.icon" :colour="app.colour" size="large" />
        <div class="min-w-0 flex-1">
          <h2 class="type-card-title">{{ app.name }}</h2>
          <p v-if="subtitle" class="truncate type-caption">{{ subtitle }}</p>
        </div>
        <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-muted" aria-hidden="true" />
      </div>

      <span v-if="figures === 'opening'" class="block h-8 w-36 rounded-control bg-elevated motion-safe:animate-pulse" aria-hidden="true" data-testid="home-card-opening"></span>
      <p v-else-if="figures === 'failed'" class="type-body" data-testid="home-card-failed">{{ words.failed }}</p>
      <template v-else-if="figures !== null">
        <dl class="flex flex-wrap gap-x-8 gap-y-3">
          <div v-for="(amount, index) in figures.amounts" :key="amount.label" class="flex flex-col gap-1">
            <dt class="type-label">{{ amount.label }}</dt>
            <dd :class="index === 0 ? 'type-figure' : 'type-figure-secondary'">
              <MoneyText :cents="amount.cents" precision="whole" :format="app.moneyFormat()" />
            </dd>
          </div>
        </dl>
        <UBadge v-if="figures.waiting" :label="figures.waiting" icon="i-lucide-inbox" color="warning" variant="subtle" class="self-start" data-testid="home-card-waiting" />
      </template>
      <template v-else>
        <p class="type-body">{{ app.homeCard.purpose }}</p>
        <UBadge v-if="setUp" :label="words.setUp" trailing-icon="i-lucide-arrow-right" color="primary" variant="solid" class="self-start" data-testid="home-card-set-up" />
      </template>
    </AppCard>
  </RouterLink>
</template>
