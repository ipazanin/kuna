<script setup lang="ts">
import { computed, watch } from 'vue'

import AssistButton from '../../../../../shared/ai/presentation/AssistButton.vue'
import CitedAnswerView from '../../../../../shared/ai/presentation/CitedAnswerView.vue'
import { resultLine, usageLine, useAiTask } from '../../../../../shared/ai/presentation/useAiTask'
import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'
import AppDialog from '../../../../../shared/ui/AppDialog.vue'
import ConfidenceBadge from '../ruleset/presentation/ConfidenceBadge.vue'
import { explainFigure } from '../assist/application/explainFigure'
import { EXPLAIN_FIGURE_SUMMARY } from '../assist/presentation/packAssist'
import { words as assistWords } from '../assist/presentation/words'
import { sourcesCheckedSince } from '../ruleset/ruleset'
import type { RuleId } from '../ruleset/ruleset'
import { words as companyWords } from '../../../words'
import { WATCHED_WORDING, chipsOf } from './tracedFigureView'
import type { FigureDetail } from './tracedFigureView'
import { words } from './words'

/** One figure opened on its build-up, the rows behind its steps and the rules it rests on, and the model's explanation of it on a tap. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  detail: FigureDetail | null
}>()

const explaining = useAiTask(explainFigure)
watch([() => props.detail, open], () => explaining.reset())

function explain(): void {
  const detail = props.detail
  if (detail?.figure) void explaining.run({ figure: detail.figure, subtitle: detail.subtitle }, detail.employees)
}

const outcome = computed(() => {
  const run = explaining.state.value
  if (run.kind !== 'done') return null
  return { answer: run.result.kind === 'draft' ? run.result.draft : null, usage: usageLine(run.result), line: resultLine(run.result) }
})

function sourceLink(id: string): { readonly label: string; readonly to: FigureDetail['to'] } {
  const [chip] = chipsOf([id as RuleId])
  return { label: chip?.title ?? id, to: chip?.to ?? null }
}

const checked = assistWords.explain.checked(dayLabel(sourcesCheckedSince()))
</script>

<template>
  <AppDialog v-model:open="open" :title="detail?.title ?? ''" :description="detail?.subtitle ?? ''">
    <div v-if="detail" class="flex flex-col gap-4" data-testid="figure-detail">
      <p class="text-lg font-medium text-highlighted"><MoneyText :cents="detail.cents" /></p>
      <section v-if="detail.steps.length > 0" :aria-label="words.figure.stepByStep">
        <h3 class="mb-1 text-xs font-medium text-muted">{{ words.figure.stepByStep }}</h3>
        <ul class="flex flex-col gap-0.5">
          <li v-for="step in detail.steps" :key="step.key" class="step-row" :class="{ 'is-nested': step.depth === 1 }">
            <DrillLink :to="step.to" :label="words.figure.openRows(step.label)" class="min-w-0">{{ step.label }}</DrillLink>
            <MoneyText v-if="step.cents !== null" :cents="step.cents" class="shrink-0 text-toned" />
          </li>
        </ul>
      </section>
      <section v-if="detail.rules.length > 0" :aria-label="words.figure.rules">
        <h3 class="mb-1 text-xs font-medium text-muted">{{ words.figure.rules }}</h3>
        <ul class="flex flex-wrap gap-x-4 gap-y-1">
          <li v-for="rule in detail.rules" :key="rule.id">
            <DrillLink :to="rule.to" :label="words.figure.openRule(rule.title)" class="text-sm text-highlighted">{{ rule.title }}</DrillLink>
          </li>
        </ul>
      </section>
      <section v-if="detail.watched.length > 0" class="flex flex-col gap-2" :aria-label="words.figure.stillToSettle">
        <p v-for="group in detail.watched" :key="group.confidence" class="flex items-start gap-2">
          <ConfidenceBadge :confidence="group.confidence" />
          <span class="min-w-0 text-xs text-muted">{{ WATCHED_WORDING[group.confidence] }}: {{ group.rules.map((rule) => rule.title).join(', ') }}.</span>
        </p>
      </section>
      <section v-if="detail.figure" class="flex flex-col items-start gap-3" :aria-label="assistWords.explain.title">
        <AssistButton
          :app="explainFigure.app"
          :app-name="companyWords.name"
          :task="EXPLAIN_FIGURE_SUMMARY"
          :label="assistWords.explain.title"
          :loading="explaining.state.value.kind === 'running'"
          :sends-employees="detail.employees"
          @run="explain"
        />
        <CitedAnswerView v-if="outcome?.answer" :answer="outcome.answer" :source-link="sourceLink" :usage="outcome.usage" :checked="checked" @retry="explain" />
        <template v-else-if="outcome">
          <p v-if="outcome.line" role="status" class="text-xs text-muted" data-testid="explain-line">{{ outcome.line }}</p>
          <p v-if="outcome.usage" class="text-xs text-muted" data-testid="explain-usage">{{ outcome.usage }}</p>
        </template>
      </section>
    </div>
  </AppDialog>
</template>

<style scoped>
.step-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--ink);
}

.step-row.is-nested {
  padding-inline-start: 0.875rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
</style>
