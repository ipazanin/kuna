<script setup lang="ts">
import { ref } from 'vue'
import UPopover from '@nuxt/ui/components/Popover.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { companyFooter, words } from './words'

withDefaults(
  defineProps<{
    /**
     * The whole footer in a row under a page, the logo and the name on up to two lines at the foot of the sidebar, or the logo alone on the
     * icon sidebar. In the sidebar and on the icons the contact, Privacy and Terms open from it with a click.
     */
    look?: 'page' | 'sidebar' | 'rail'
  }>(),
  { look: 'page' },
)

const open = ref(false)
const privacyPage = `${import.meta.env.BASE_URL}privacy.html`
const termsPage = `${import.meta.env.BASE_URL}terms.html`
</script>

<template>
  <footer v-if="look === 'page'" class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-default pt-4 type-caption print:hidden" data-testid="company-footer">
    <span class="flex items-center gap-2">
      <span class="company-logo shrink-0" aria-hidden="true" data-testid="company-logo"></span>
      <span>{{ companyFooter.name }}</span>
    </span>
    <a :href="`mailto:${companyFooter.email}`" class="quiet-link">{{ companyFooter.email }}</a>
    <a :href="privacyPage" class="quiet-link">{{ words.privacy }}</a>
    <a :href="termsPage" class="quiet-link">{{ words.terms }}</a>
  </footer>
  <footer v-else class="print:hidden" data-testid="company-footer">
    <UPopover v-model:open="open" :content="{ side: look === 'rail' ? 'right' : 'top', align: look === 'rail' ? 'end' : 'start', collisionPadding: 12 }">
      <UTooltip :text="companyFooter.name" :disabled="look !== 'rail' || open" :content="{ side: 'right' }">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-control py-1.5 text-start type-caption transition-colors hover:bg-elevated"
          :class="look === 'rail' ? 'justify-center' : 'px-2'"
          data-testid="company-footer-open"
        >
          <span class="company-logo shrink-0" aria-hidden="true" data-testid="company-logo"></span>
          <span :class="look === 'rail' ? 'sr-only' : 'line-clamp-2 min-w-0'">{{ companyFooter.name }}</span>
        </button>
      </UTooltip>
      <template #content>
        <div class="flex max-w-72 flex-col gap-2 p-3 type-caption" data-testid="company-footer-lines">
          <span>{{ companyFooter.name }}</span>
          <a :href="`mailto:${companyFooter.email}`" class="quiet-link">{{ companyFooter.email }}</a>
          <a :href="privacyPage" class="quiet-link">{{ words.privacy }}</a>
          <a :href="termsPage" class="quiet-link">{{ words.terms }}</a>
        </div>
      </template>
    </UPopover>
  </footer>
</template>
