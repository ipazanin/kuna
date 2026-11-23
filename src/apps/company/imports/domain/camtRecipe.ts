import type { Recipe, RecipeField, RecipeFields, RecipeSection, XmlFile } from '../../../../shared/recipes/domain/recipe'

/** Every field is read as its text, blank where the file gives none, since the statement's own checks decide what a blank means. */
function texts(columns: Readonly<Record<string, string>>): RecipeFields {
  return Object.fromEntries(Object.entries(columns).map(([name, from]): [string, RecipeField] => [name, { from, as: 'text', blank: true }]))
}

function section(name: string, rows: string, fields: Readonly<Record<string, string>>, within?: string): RecipeSection {
  return { name, rows, ...(within === undefined ? {} : { within }), cells: 'elements', keep: [], shown: [], fields: texts(fields), kinds: [{ kind: name, when: [], fields: {} }] }
}

/** The first transaction's details of an entry, where a camt.053 names the other side, the purpose and the remittance. */
const DETAILS = 'NtryDtls/TxDtls'

/** The other side of an entry, debtor or creditor, as the details name it. */
function party(role: 'Dbtr' | 'Cdtr'): Readonly<Record<string, string>> {
  const parties = `${DETAILS}/RltdPties`
  return { [`${role}Name`]: `${parties}/${role}/Pty/Nm`, [`${role}ShortName`]: `${parties}/${role}/Nm`, [`${role}Iban`]: `${parties}/${role}Acct/Id/IBAN` }
}

/**
 * A bank's camt.053 statement, any version, as Kuna reads it: each statement with its account, balances and summary, each
 * entry with its details, and each entry's transactions, which tell a batched booking. An entry the bank has not booked is
 * left for the person to see, as no kind takes it. Every value is read as written, and `camtStatement` checks them.
 */
export const CAMT_RECIPE: Recipe<XmlFile> = {
  id: 'camt-053',
  name: 'camt.053',
  file: { format: 'xml', root: 'Document' },
  sections: [
    section('statements', 'BkToCstmrStmt/Stmt', {
      created: 'CreDtTm',
      sequence: 'LglSeqNb',
      iban: 'Acct/Id/IBAN',
      currency: 'Acct/Ccy',
      bic: 'Acct/Svcr/FinInstnId/BICFI',
      olderBic: 'Acct/Svcr/FinInstnId/BIC',
      owner: 'Acct/Ownr/Nm',
      accountName: 'Acct/Nm',
      servicer: 'Acct/Svcr/FinInstnId/Nm',
    }),
    section('balances', 'Bal', { code: 'Tp/CdOrPrtry/Cd', amount: 'Amt', currency: 'Amt@Ccy', indicator: 'CdtDbtInd' }, 'statements'),
    section('summaries', 'TxsSummry', { debitCount: 'TtlDbtNtries/NbOfNtries', debitSum: 'TtlDbtNtries/Sum', creditCount: 'TtlCdtNtries/NbOfNtries', creditSum: 'TtlCdtNtries/Sum' }, 'statements'),
    {
      ...section(
        'entries',
        'Ntry',
        {
          servicerReference: 'AcctSvcrRef',
          entryReference: 'NtryRef',
          indicator: 'CdtDbtInd',
          amount: 'Amt',
          currency: 'Amt@Ccy',
          reversal: 'RvslInd',
          bookedOn: 'BookgDt/Dt',
          bookedAt: 'BookgDt/DtTm',
          valueOn: 'ValDt/Dt',
          valueAt: 'ValDt/DtTm',
          domain: 'BkTxCd/Domn/Cd',
          family: 'BkTxCd/Domn/Fmly/Cd',
          subFamily: 'BkTxCd/Domn/Fmly/SubFmlyCd',
          purpose: `${DETAILS}/Purp/Cd`,
          creditorReference: `${DETAILS}/RmtInf/Strd/CdtrRefInf/Ref`,
          instructedCurrency: `${DETAILS}/AmtDtls/InstdAmt/Amt@Ccy`,
          ...party('Dbtr'),
          ...party('Cdtr'),
          lines: `${DETAILS}/RmtInf/Ustrd*`,
          remittanceNote: `${DETAILS}/RmtInf/Strd/AddtlRmtInf`,
          entryNote: 'AddtlNtryInf',
        },
        'statements',
      ),
      // An older camt.053 writes the status as text, a newer one as a code inside it.
      kinds: [
        { kind: 'booked', when: [{ column: 'Sts/Cd', is: ['BOOK'] }], fields: {} },
        { kind: 'booked', when: [{ column: 'Sts', is: ['BOOK'] }], fields: {} },
      ],
    },
    section('details', 'NtryDtls', { batch: 'Btch/NbOfTxs' }, 'entries'),
    section('transactions', 'TxDtls', {}, 'details'),
  ],
}
