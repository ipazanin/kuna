import { ASSETS_OPERATIONS } from '../../src/apps/assets/assistant/operations/assetsOperations'
import { companyOperations } from '../../src/apps/company/assistant/operations/companyOperations'
import { hrDooOperations } from '../../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import { INVESTMENTS_OPERATIONS } from '../../src/apps/investments/assistant/operations/investmentsOperations'
import { LOANS_OPERATIONS } from '../../src/apps/loans/assistant/operations/loansOperations'
import { SPENDING_OPERATIONS } from '../../src/apps/spending/assistant/operations/spendingOperations'
import type { AssistantOperation } from '../../src/shared/app/assistantOperations'
import { kunaOperations } from '../../src/shell/assistant/kunaOperations'
import type { KunaDevice } from '../../src/shell/assistant/kunaOperations'
import { deskPorts } from './companyDesk'

/** A device with Company installed and the chat's widths, which is all Kuna's operations read to list their inputs. */
const DEVICE = { apps: () => [{ id: 'company', name: 'Company' }], chatWidths: { least: 384, most: 704, reset: 384 } } as unknown as KunaDevice

/** Every app's operations by the app's id, Company's with the pack's, as the chat lists them. */
export const APP_OPERATIONS: ReadonlyMap<string, readonly AssistantOperation[]> = new Map([
  ['spending', SPENDING_OPERATIONS],
  ['company', companyOperations(deskPorts({ pack: hrDooOperations(() => false) }))],
  ['loans', LOANS_OPERATIONS],
  ['investments', INVESTMENTS_OPERATIONS],
  ['assets', ASSETS_OPERATIONS],
  ['kuna', kunaOperations(DEVICE)],
])
