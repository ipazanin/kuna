<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { fold } from '../../../../shared/text/fold'
import AppCard from '../../../../shared/ui/AppCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import { useSettings } from '../../../../features/settings/application/useSettings'
import { findLocalUnit } from '../localUnits'
import { RULES, RULESET_CHECKED_ON, watchItems } from '../ruleset'
import type { GeneralRule, RuleArea } from '../schema'
import ConfidenceBadge from './ConfidenceBadge.vue'
import RuleCard from './RuleCard.vue'
import WatchList from './WatchList.vue'
import { AREA_WORDING, CONFIDENCE_ORDER, CONFIDENCE_WORDING, dayLabel, openItemView, ruleView, termFormat, watchedVersionView } from './ruleWording'
import type { TableFocus } from './ruleWording'

type AreaChoice = RuleArea | 'all'

const route = useRoute()
const settings = useSettings()
const phone = usePhoneLayout()

const generalRules: readonly GeneralRule[] = RULES
const areas: readonly RuleArea[] = [...new Set(generalRules.map((rule) => rule.area))]
const checkedOn = dayLabel(RULESET_CHECKED_ON)

const rules = computed(() => {
  const format = termFormat(settings.value.numberLocale)
  return generalRules.map((rule) => ruleView(rule, format))
})

/** The local rates open on the unit the owner lives in, found by its name and its county. */
const localRatesFocus = computed((): TableFocus => {
  const { unit } = findLocalUnit(settings.value.companyFacts.residenceCity)
  return unit === null
    ? { cells: null, hint: 'Search for a city or municipality, or show them all. Set where the owner lives in Settings to open on that one.' }
    : { cells: [unit.unit, unit.county], hint: '' }
})

function tableFocusOf(ruleId: string): TableFocus | null {
  return ruleId === 'hr.pit.local-rates' ? localRatesFocus.value : null
}

const watched = watchItems().map((watchItem) => (watchItem.kind === 'version' ? watchedVersionView(watchItem.rule, watchItem.version) : openItemView(watchItem.item)))

const search = ref('')
const area = ref<AreaChoice>('all')
const searched = computed(() => fold(search.value))

const matchesSearch = (searchText: string): boolean => searched.value === '' || searched.value.split(' ').every((word) => searchText.includes(word))

const rulesFound = computed(() => rules.value.filter((rule) => matchesSearch(rule.searchText)))
const rulesShown = computed(() => rulesFound.value.filter((rule) => area.value === 'all' || rule.area === area.value))
const watchShown = computed(() => watched.filter((item) => (area.value === 'all' || item.area === area.value) && matchesSearch(item.searchText)))

const areaChoices = computed(() => [
  { area: 'all' as const, label: 'All areas', count: rulesFound.value.length },
  ...areas.map((choice) => ({ area: choice, label: AREA_WORDING[choice].label, count: rulesFound.value.filter((rule) => rule.area === choice).length })),
])

const sections = computed(() =>
  areas
    .map((choice) => ({ area: choice, ...AREA_WORDING[choice], rules: rulesShown.value.filter((rule) => rule.area === choice) }))
    .filter((section) => section.rules.length > 0),
)

const linkedRule = computed(() => (typeof route.query.rule === 'string' ? route.query.rule : null))
const linkedMissing = computed(() => linkedRule.value !== null && !rules.value.some((rule) => rule.id === linkedRule.value))

const filterBar = ref<HTMLElement | null>(null)

/** Scrolls the linked rule to just below the sticky filter bar and moves focus to it, so a screen reader reads it next. */
function showLinkedRule(ruleId: string): void {
  const card = document.getElementById(`rule-${ruleId}`)
  if (card === null) {
    return
  }
  const bar = filterBar.value
  const barBottom = bar === null ? 0 : Number.parseFloat(getComputedStyle(bar).top || '0') + bar.offsetHeight
  window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - barBottom - 12 })
  card.focus({ preventScroll: true })
}

watch(
  linkedRule,
  async (ruleId) => {
    if (ruleId === null || !rules.value.some((rule) => rule.id === ruleId)) {
      return
    }
    search.value = ''
    area.value = 'all'
    await nextTick()
    // The router scrolls a newly opened screen to its top after it renders. The screen's first frame
    // then asks for the web fonts its text needs, and they move every card once they swap in, so the
    // rule is shown after the fonts have loaded.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await document.fonts.ready
    showLinkedRule(ruleId)
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader
      title="Ruleset"
      :description="`The Croatian law behind the pack's figures: each rule's value per year, the article it comes from, and how sure that value is. Checked against the sources on ${checkedOn}.`"
    />

    <div ref="filterBar" role="search" class="ruleset-bar" data-testid="ruleset-bar">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        enterkeyhint="search"
        placeholder="Search by rule id, name, act or article"
        aria-label="Search the ruleset"
        class="ruleset-search"
        data-testid="ruleset-search"
      >
        <template v-if="search" #trailing>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Clear the search" @click="search = ''" />
        </template>
      </UInput>
      <div role="group" aria-label="Area" class="areas flex rounded-control border border-default bg-raised p-0.5">
        <button
          v-for="choice in areaChoices"
          :key="choice.area"
          type="button"
          class="area"
          :aria-pressed="area === choice.area"
          :data-testid="`area-${choice.area}`"
          @click="area = choice.area"
        >
          {{ choice.label }} <span class="figure text-muted">{{ choice.count }}</span>
        </button>
      </div>
      <p class="figure text-xs text-muted" aria-live="polite" data-testid="ruleset-count">
        {{ rulesShown.length === rules.length ? `${rules.length} rules` : `${rulesShown.length} of ${rules.length} rules` }}
      </p>
    </div>

    <AppCard v-if="linkedMissing" as="div" class="px-4 py-3" role="status">
      <p class="text-sm text-toned">
        The link points at <span class="identifier">{{ linkedRule }}</span>, which is not in the ruleset. It may have been renamed, so search for it below.
      </p>
    </AppCard>

    <WatchList :items="watchShown" :total="watched.length" :checked-on="checkedOn" :searching="searched !== ''" />

    <p v-if="sections.length === 0" class="py-6 text-sm text-muted">
      No rule matches "{{ search }}"{{ area === 'all' ? '' : ` in ${AREA_WORDING[area].label}` }}.
      <UButton label="Clear the search" color="neutral" variant="link" size="sm" class="inline-target" @click="search = ''; area = 'all'" />
    </p>

    <section v-for="section in sections" :key="section.area" class="flex flex-col gap-3" :aria-labelledby="`area-${section.area}-title`">
      <header>
        <h2 :id="`area-${section.area}-title`" class="text-base font-semibold text-highlighted">
          {{ section.label }} <span class="figure text-sm font-normal text-muted">{{ section.rules.length }}</span>
        </h2>
        <p class="mt-0.5 text-xs text-muted">{{ section.description }}</p>
      </header>
      <RuleCard
        v-for="rule in section.rules"
        :key="rule.id"
        :rule="rule"
        :phone="phone"
        :linked="rule.id === linkedRule"
        :table-focus="tableFocusOf(rule.id)"
      />
    </section>

    <AppCard title="How sure each value is" subtitle="Every version of a rule carries one of these marks. The figures are for planning with the accountant, never filing advice.">
      <dl class="marks px-4 pt-3 pb-4 sm:px-5">
        <div v-for="confidence in CONFIDENCE_ORDER" :key="confidence" class="flex flex-col items-start gap-1">
          <dt><ConfidenceBadge :confidence="confidence" /></dt>
          <dd class="text-xs text-toned">{{ CONFIDENCE_WORDING[confidence].meaning }}</dd>
        </div>
      </dl>
    </AppCard>
  </section>
</template>

<style scoped>
/* Search and areas stay in reach while the list scrolls, as the filter bar does on the ledger screens. */
.ruleset-bar {
  position: sticky;
  top: 3.5rem;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-inline: -0.5rem;
  padding: 0.5rem;
  background: color-mix(in srgb, var(--surface-page) 92%, transparent);
  backdrop-filter: blur(10px);
}

@media (min-width: 1024px) {
  .ruleset-bar {
    top: 0;
  }
}

.ruleset-search {
  width: 100%;
}

@media (min-width: 640px) {
  .ruleset-search {
    width: 20rem;
  }
}

.areas {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.area {
  flex-shrink: 0;
  padding: 0.3125rem 0.625rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--ink-muted);
  white-space: nowrap;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.area:hover {
  color: var(--ink-strong);
  background: var(--surface-elevated);
}

.area[aria-pressed='true'] {
  color: var(--accent-strong);
  background: var(--accent-wash);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  font-weight: 500;
}

.area:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.marks {
  display: grid;
  gap: 1rem 1.5rem;
}

@media (min-width: 640px) {
  .marks {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .marks {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
