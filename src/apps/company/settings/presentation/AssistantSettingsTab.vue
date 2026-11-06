<script setup lang="ts">
import AppAssistCard from '../../../../shared/ai/presentation/AppAssistCard.vue'
import { suggestCategories } from '../../assist/application/suggestCategories'
import { COMPANY_ASSIST } from '../../assist/presentation/companyAssist'
</script>

<template>
  <AppAssistCard :app="suggestCategories.app" :tasks="COMPANY_ASSIST.tasks()" />
</template>
