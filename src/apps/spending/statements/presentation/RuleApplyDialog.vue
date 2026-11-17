<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { rowsRulesWouldChange, writeRules } from '../application/statementWrites'
import { changesHeldRule } from './ruleAsk'
import type { RuleAsk } from './ruleAsk'
import { words } from './words'
import { loanLinks } from '../../links/presentation/loanLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { words as spendingWords } from '../../words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'

/**
 * Asks before a change to the rules is written whether the rows already in the book follow it, with how many would change. With
 * no row to change it only confirms. A dialog that comes to the question from a step of its own, such as the rule's form, puts that
 * step in the slots, shown while nothing is asked, and gets Back in place of Cancel.
 */
const open = defineModel<boolean>('open', { required: true })

const props = withDefaults(
  defineProps<{
    /** The change to write, or null while nothing is asked. */
    asked: RuleAsk | null
    /** The title and description of the step the slots hold. */
    title?: string
    description?: string | undefined
    /** Back to the step the slots hold, in place of Cancel. */
    back?: boolean
  }>(),
  { title: words.rules.apply.title, description: undefined, back: false },
)

const emit = defineEmits<{ back: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const book = computed(() => store.state.workbook)

/** What the question says, read when it is asked, so it stays as it was while the dialog closes over the write. */
const rowsChanged = ref(0)
const changesHeld = ref(false)
watch(
  [open, () => props.asked],
  ([opened, asked]) => {
    const current = book.value
    if (!opened || asked === null || current === null) return
    rowsChanged.value = rowsRulesWouldChange(current, asked.edits, loanLinks())
    changesHeld.value = changesHeldRule(current.rules, asked.edits)
  },
  { immediate: true },
)

const choices = computed(() => {
  const { apply } = words.rules
  if (rowsChanged.value === 0) return { all: words.rules.confirm, none: null, icon: 'i-lucide-save', kept: null }
  return props.asked?.choice === 'refile'
    ? { all: apply.refile, none: apply.leave, icon: 'i-lucide-list-restart', kept: apply.keptCategory }
    : { all: apply.apply, none: apply.onlyNew, icon: 'i-lucide-save', kept: apply.kept }
})

async function write(refile: boolean): Promise<void> {
  const current = book.value
  const { asked } = props
  if (current === null || asked === null) return
  const written = await writes.write(
    asked.written,
    (unit) => {
      asked.alongside?.(unit)
      writeRules(unit, current, asked.edits, loanLinks(), refile)
    },
    { key: refile ? 'apply' : 'only-new', failedTitle: spendingWords.form.notSaved },
  )
  if (written) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="asked?.title ?? title" :description="asked === null ? description : asked.description">
    <div v-if="asked !== null" class="flex flex-col gap-1" data-testid="spending-rule-apply-dialog">
      <p class="text-sm text-highlighted" data-testid="spending-rule-files">
        {{ rowsChanged === 0 ? words.rules.apply.nothing : plural(words.rules.apply.changes(rowsChanged), rowsChanged) }}
      </p>
      <p v-if="changesHeld" class="type-caption" data-testid="spending-rule-joins">{{ words.rules.apply.joins }}</p>
      <p v-if="choices.kept !== null" class="type-caption">{{ choices.kept }}</p>
    </div>
    <slot v-else />
    <template #end>
      <template v-if="asked !== null">
        <UButton v-if="back" :label="words.rules.apply.back" color="neutral" variant="ghost" data-testid="spending-rule-back" @click="emit('back')" />
        <UButton v-else :label="spendingWords.form.cancel" color="neutral" variant="ghost" data-testid="spending-rule-cancel" @click="open = false" />
        <UButton
          v-if="choices.none !== null"
          :label="choices.none"
          color="neutral"
          variant="outline"
          :loading="writes.saving('only-new')"
          :disabled="writes.refused.value"
          data-testid="spending-rule-only-new"
          @click="write(false)"
        />
        <UButton :label="choices.all" :icon="choices.icon" :loading="writes.saving('apply')" :disabled="writes.refused.value" data-testid="spending-rule-confirm" @click="write(true)" />
      </template>
      <slot v-else name="end" />
    </template>
  </AppDialog>
</template>
