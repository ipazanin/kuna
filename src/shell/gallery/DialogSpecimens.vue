<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../shared/ui/AppCard.vue'
import AppDialog from '../../shared/ui/AppDialog.vue'
import FigureTable from '../../shared/ui/FigureTable.vue'
import FormGrid from '../../shared/ui/FormGrid.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import GallerySection from './GallerySection.vue'

const formOpen = ref(false)
const tableOpen = ref(false)
const confirmOpen = ref(false)
const tried = ref(false)
const subsidised = ref(true)

const ROWS = [
  { due: '20 Oct 2026', payment: 82220, interest: 39992, principal: 42228 },
  { due: '20 Nov 2026', payment: 82220, interest: 39854, principal: 42366 },
  { due: '20 Dec 2026', payment: 82220, interest: 39716, principal: 42504 },
] as const
</script>

<template>
  <GallerySection
    id="form-grid"
    title="FormGrid"
    description="Two fields to a row from 640 px, the labels in a row of their own, so the inputs line up however long a label runs. A wide field spans the row."
  >
    <AppCard as="div" class="p-5">
      <FormGrid data-testid="gallery-form-grid">
        <UFormField label="Name" :error="(tried && 'A name, such as Home loan') || false">
          <UInput placeholder="Home loan" class="w-full" />
        </UFormField>
        <UFormField label="Interest the bank charged before the first instalment, if it did" help="What the bank charged from the payout.">
          <UInput placeholder="0.00" inputmode="decimal" class="w-full" />
        </UFormField>
        <UFormField label="Monthly instalments" help="240 for 20 years.">
          <UInput inputmode="numeric" class="w-full" />
        </UFormField>
        <UFormField label="First instalment">
          <UInput type="date" class="w-full" />
        </UFormField>
        <USwitch v-model="subsidised" label="A subsidy pays part of each instalment" description="A switch takes the whole row." />
        <UFormField label="Note" class="sm:col-span-2">
          <UInput class="w-full" />
        </UFormField>
      </FormGrid>
      <USwitch v-model="tried" label="Show the errors" class="mt-4" />
    </AppCard>
  </GallerySection>

  <GallerySection id="dialog" title="AppDialog" description="Full screen on a phone. Delete and the like at the start of the footer, Cancel and the primary action at its end.">
    <div class="flex flex-wrap gap-2">
      <UButton label="A form" color="neutral" variant="outline" data-testid="gallery-dialog-form" @click="formOpen = true" />
      <UButton label="A wide table" color="neutral" variant="outline" @click="tableOpen = true" />
      <UButton label="A confirmation" color="neutral" variant="outline" @click="confirmOpen = true" />
    </div>

    <AppDialog v-model:open="formOpen" title="Change the bank loan" description="Its terms. Rate periods and extra payments change on the loan's page.">
      <FormGrid id="gallery-form" as="form" @submit.prevent="formOpen = false">
        <UFormField label="Name">
          <UInput placeholder="Home loan" class="w-full" />
        </UFormField>
        <UFormField label="Interest before the first instalment" help="What the bank charged from the payout, if it did.">
          <UInput placeholder="0.00" inputmode="decimal" class="w-full" />
        </UFormField>
        <UFormField label="Note" class="sm:col-span-2">
          <UInput class="w-full" />
        </UFormField>
      </FormGrid>
      <template #start>
        <UButton label="Delete loan" icon="i-lucide-trash-2" color="error" variant="ghost" @click="formOpen = false" />
      </template>
      <template #end>
        <UButton label="Cancel" color="neutral" variant="ghost" @click="formOpen = false" />
        <UButton type="submit" form="gallery-form" label="Save loan" icon="i-lucide-save" />
      </template>
    </AppDialog>

    <AppDialog v-model:open="tableOpen" width="2xl" title="Plan for 2026" description="A dialog whose body is a table takes a wider panel.">
      <FigureTable label="Plan for 2026">
        <thead>
          <tr>
            <th scope="col" class="text-start">Due</th>
            <th scope="col" class="text-end">Instalment</th>
            <th scope="col" class="text-end">Interest</th>
            <th scope="col" class="text-end">Principal</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ROWS" :key="row.due">
            <th scope="row" class="text-start font-normal text-toned">{{ row.due }}</th>
            <td class="text-end"><MoneyText :cents="row.payment" /></td>
            <td class="text-end"><MoneyText :cents="row.interest" /></td>
            <td class="text-end"><MoneyText :cents="row.principal" /></td>
          </tr>
        </tbody>
      </FigureTable>
      <template #end>
        <UButton label="Close" color="neutral" @click="tableOpen = false" />
      </template>
    </AppDialog>

    <AppDialog v-model:open="confirmOpen" width="md" title="Delete the books in this browser" description="The books are deleted from this browser and cannot be recovered.">
      <p class="type-body">A confirmation keeps its question in the title and its answer in the buttons.</p>
      <template #end>
        <UButton label="Keep them" color="neutral" variant="ghost" @click="confirmOpen = false" />
        <UButton label="Delete the books" icon="i-lucide-trash-2" color="error" @click="confirmOpen = false" />
      </template>
    </AppDialog>
  </GallerySection>
</template>
