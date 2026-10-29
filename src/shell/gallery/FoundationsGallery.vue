<script setup lang="ts">
import { computed } from 'vue'

import { tokenColour } from '../../shared/charts/chartTokens'
import AppCard from '../../shared/ui/AppCard.vue'
import { contrastRatio } from './contrast'
import GallerySection from './GallerySection.vue'

interface Swatch {
  readonly name: string
  readonly token: string
}

/** Text tokens show their contrast on the three surfaces text sits on. */
const TEXT_SURFACES: readonly Swatch[] = [
  { name: 'page', token: '--surface-page' },
  { name: 'raised', token: '--surface-raised' },
  { name: 'elevated', token: '--surface-elevated' },
]

const COLOUR_GROUPS: readonly { readonly title: string; readonly text: boolean; readonly swatches: readonly Swatch[] }[] = [
  {
    title: 'Surfaces and borders',
    text: false,
    swatches: [
      { name: 'Page', token: '--surface-page' },
      { name: 'Raised', token: '--surface-raised' },
      { name: 'Elevated', token: '--surface-elevated' },
      { name: 'Accented', token: '--surface-accented' },
      { name: 'Border', token: '--border-default' },
      { name: 'Border strong', token: '--border-strong' },
    ],
  },
  {
    title: 'Ink, with its contrast on the page, a card and a popover',
    text: true,
    swatches: [
      { name: 'Ink strong', token: '--ink-strong' },
      { name: 'Ink', token: '--ink' },
      { name: 'Ink secondary', token: '--ink-secondary' },
      { name: 'Ink muted', token: '--ink-muted' },
    ],
  },
  {
    title: 'Accent and tones, as text-primary, text-error, text-success, text-warning and text-info',
    text: true,
    swatches: [
      { name: 'Accent', token: '--accent' },
      { name: 'Error', token: '--tone-negative' },
      { name: 'Success', token: '--tone-positive' },
      { name: 'Warning', token: '--tone-warning' },
      { name: 'Info', token: '--tone-info' },
    ],
  },
  {
    title: 'Categorical order, with the bucket each slot carries',
    text: false,
    swatches: [
      { name: '1 Income', token: '--series-1' },
      { name: '2 Operating', token: '--series-2' },
      { name: '3 Taxes', token: '--series-3' },
      { name: '4 Owner pay', token: '--series-4' },
      { name: '5 Financing', token: '--series-5' },
      { name: '6', token: '--series-6' },
      { name: '7', token: '--series-7' },
      { name: '8', token: '--series-8' },
      { name: 'Neutral', token: '--bucket-neutral' },
    ],
  },
  {
    title: 'Loans: principal, the balance still to come, interest',
    text: false,
    swatches: [
      { name: 'Principal', token: '--loan-principal' },
      { name: 'Still to come', token: '--loan-ahead' },
      { name: 'Interest', token: '--loan-interest' },
    ],
  },
  {
    title: 'How late money owed is',
    text: false,
    swatches: [1, 2, 3, 4, 5].map((step) => ({ name: `Step ${step}`, token: `--ageing-${step}` })),
  },
]

/** Each swatch's value in the theme on screen, and for text its contrast on each text surface. */
const groups = computed(() =>
  COLOUR_GROUPS.map((group) => ({
    ...group,
    swatches: group.swatches.map((swatch) => {
      const value = tokenColour(swatch.token)
      return {
        ...swatch,
        value,
        contrasts: group.text ? TEXT_SURFACES.map((surface) => ({ surface: surface.name, ratio: contrastRatio(value, tokenColour(surface.token)) })) : [],
      }
    }),
  })),
)

const TYPE_ROLES = [
  { role: 'type-page-title', use: 'The screen title', sample: 'Period review, 2026 against 2025' },
  { role: 'type-card-title', use: 'A card or section title', sample: 'Income and costs by month' },
  { role: 'type-figure', use: 'The figure a tile or card leads with', sample: '€148,210' },
  { role: 'type-body', use: 'Running text in a card', sample: 'Net taxes are taxes paid minus refunds, so a refund never flatters the rate.' },
  { role: 'type-label', use: 'A small heading over a group of figures or a column', sample: 'What can be paid out' },
  { role: 'type-caption', use: 'Subtitles, captions and the line under a figure', sample: 'Last 12 months against the 12 before' },
] as const
</script>

<template>
  <GallerySection id="colour" title="Colour" description="Every token in the theme on screen. A text token shows its contrast, and one under 4.5:1 says so.">
    <div class="flex flex-col gap-6">
      <div v-for="group in groups" :key="group.title">
        <h3 class="mb-2 type-label">{{ group.title }}</h3>
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
          <li v-for="swatch in group.swatches" :key="swatch.token" class="overflow-hidden rounded-control border border-default bg-raised" data-testid="gallery-swatch">
            <span class="block h-10" :style="{ background: `var(${swatch.token})` }" />
            <span class="block px-2 py-1.5 text-xs">
              <span class="block text-highlighted">{{ swatch.name }}</span>
              <span class="identifier block text-muted">{{ swatch.token }}</span>
              <span class="identifier block text-muted">{{ swatch.value }}</span>
              <span v-for="contrast in swatch.contrasts" :key="contrast.surface" class="figure block" :class="contrast.ratio !== null && contrast.ratio < 4.5 ? 'text-error' : 'text-toned'">
                {{ contrast.ratio === null ? '–' : `${contrast.ratio.toFixed(2)}:1` }} on {{ contrast.surface }}<template v-if="contrast.ratio !== null && contrast.ratio < 4.5">, fails</template>
              </span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </GallerySection>

  <GallerySection id="type" title="Type roles" description="Inter, with tabular figures where numbers line up. A screen picks a role rather than a size and an ink.">
    <AppCard as="div" class="gap-4 p-5">
      <div v-for="entry in TYPE_ROLES" :key="entry.role" class="flex flex-col gap-1 border-b border-default pb-4 last:border-b-0 last:pb-0">
        <p :class="entry.role">{{ entry.sample }}</p>
        <p class="type-caption">
          <span class="identifier">{{ entry.role }}</span
          >, {{ entry.use }}
        </p>
      </div>
      <div class="flex flex-col gap-1">
        <p class="text-figure-xl font-semibold text-highlighted tabular-nums">€154,274.21</p>
        <p class="type-caption"><span class="identifier">text-figure-xl</span>, the one figure a hero card leads with</p>
      </div>
      <div class="flex flex-col gap-1">
        <p class="figure text-sm text-default">€1,111.11 / €8,888.88 / −€404.04</p>
        <p class="identifier text-toned">HR00 0000 0000 0000 0000 0</p>
        <p class="type-caption"><span class="identifier">figure</span> and <span class="identifier">identifier</span>, figures in running text and codes such as an IBAN</p>
      </div>
    </AppCard>
  </GallerySection>

  <GallerySection id="shape" title="Radii and elevation">
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="flex h-24 items-end rounded-card border border-default bg-raised p-3 type-caption"><span class="identifier">rounded-card</span>, cards and tiles</div>
      <div class="flex h-24 items-end rounded-control border border-default bg-raised p-3 type-caption"><span class="identifier">rounded-control</span>, controls and swatches</div>
      <div class="flex h-24 items-end rounded-card border border-default bg-raised p-3 shadow-raised type-caption"><span class="identifier">shadow-raised</span>, a card on the page</div>
      <div class="flex h-24 items-end rounded-card border border-default bg-elevated p-3 shadow-overlay type-caption"><span class="identifier">shadow-overlay</span>, a popover or dialog</div>
    </div>
  </GallerySection>
</template>
