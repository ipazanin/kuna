import type { AskedElement } from '../../../../../shared/ai/presentation/chatDock'
import { COMPANY_APP } from '../../../workbook/domain/companyApp'
import { figureTraceOf } from '../assistant/buildUpRead'
import type { AskableDetail } from './tracedFigureView'

/** A figure's build-up as the chat is asked about it, which `read_build_up` reads. Employees' pay is marked, so the read refuses it while Anonymise is on. */
export function figureAsked(detail: AskableDetail): AskedElement {
  return {
    key: `build-up:${detail.title}:${detail.subtitle}`,
    label: detail.askLabel,
    about: { kind: 'build-up', app: COMPANY_APP, trace: figureTraceOf(detail.figure), subtitle: detail.subtitle, employees: detail.employees },
  }
}
