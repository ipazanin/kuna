import { INVESTMENTS_ASSISTANT_ROUTE } from '../overview/presentation/investmentLinks'
import type { AppAssist } from '../../../shared/app/appContribution'

/** Where Investments keeps its assistant switch. It has no task of its own, since the chat does its work. */
export const INVESTMENTS_ASSIST: AppAssist = { settings: INVESTMENTS_ASSISTANT_ROUTE, tasks: () => [] }
