import type { AppSettings } from '../../../../shared/app/appContribution'
import LoansBooksCard from './LoansBooksCard.vue'

/** The Loans parts of Settings: no tab yet, and where the Loans file is on This device. */
export const LOANS_SETTINGS: AppSettings = {
  tabs: () => [],
  deviceCards: () => [LoansBooksCard],
}
