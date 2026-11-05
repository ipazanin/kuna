/**
 * Calls Enable Banking for Kuna, which runs in a browser and may hold no private key. Kuna calls the four functions below
 * through the Apps Script API. Script Properties hold the application id, the private key and one session id per bank.
 * Nothing a bank answers is stored or logged here.
 */

const API = 'https://api.enablebanking.com'
const COUNTRY = 'HR'
const TOKEN_SECONDS = 3600
const SESSION_PREFIX = 'SESSION '
const MAX_PAGES = 500

/** Starts a bank's approval for as long as the bank allows, and says where to send the tab. */
function startLink(bank, redirectUrl, state) {
  const aspsp = call_('get', `/aspsps?country=${COUNTRY}`).aspsps.find((candidate) => candidate.name === bank)
  if (aspsp === undefined) throw new Error(`Enable Banking lists no ${bank} in ${COUNTRY}`)
  const validUntil = new Date(Date.now() + (aspsp.maximum_consent_validity - 60) * 1000).toISOString()
  const started = call_('post', '/auth', { access: { valid_until: validUntil }, aspsp: { name: bank, country: COUNTRY }, state, redirect_url: redirectUrl, psu_type: 'personal' })
  return { url: started.url }
}

/** Trades the code the bank came back with for a session, and keeps only the session's id. The session it replaces is closed, since nothing could reach it afterwards. */
function finishLink(code) {
  const session = call_('post', '/sessions', { code })
  const properties = PropertiesService.getScriptProperties()
  const key = SESSION_PREFIX + session.aspsp.name
  const replaced = properties.getProperty(key)
  properties.setProperty(key, session.session_id)
  if (replaced !== null && replaced !== session.session_id) closeSession_(replaced)
  return { validUntil: session.access.valid_until }
}

/** A bank that allows one session has already ended the old one, so a refusal here changes nothing. */
function closeSession_(sessionId) {
  try {
    call_('delete', `/sessions/${sessionId}`)
  } catch (refusal) {
    return
  }
}

/** Each bank's session with the accounts it reaches, which restricted mode cuts down to the accounts linked in Enable Banking's panel. One bank failing is that bank's answer, and leaves the others theirs. */
function accounts() {
  const properties = PropertiesService.getScriptProperties().getProperties()
  return Object.keys(properties)
    .filter((key) => key.startsWith(SESSION_PREFIX))
    .map((key) => {
      const bank = key.slice(SESSION_PREFIX.length)
      try {
        const session = call_('get', `/sessions/${properties[key]}`)
        return { bank, status: session.status, accounts: session.status === 'AUTHORIZED' ? session.accounts.map(accountOf_) : [] }
      } catch (failure) {
        return { bank, status: 'FAILED', reason: failure.message, accounts: [] }
      }
    })
}

function accountOf_(uid) {
  const details = call_('get', `/accounts/${uid}/details`)
  return { uid, iban: details.account_id?.iban ?? '', currency: details.currency }
}

/** Every page of an account's transactions from the day. A page may be empty and still name a next one, so only a missing key ends the list. */
function transactions(accountUid, from, strategy) {
  const found = []
  let continuationKey = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = [`date_from=${from}`, `strategy=${strategy}`, ...(continuationKey === null ? [] : [`continuation_key=${encodeURIComponent(continuationKey)}`])]
    const answer = call_('get', `/accounts/${accountUid}/transactions?${query.join('&')}`)
    found.push(...answer.transactions.map(transactionOf_))
    continuationKey = answer.continuation_key ?? null
    if (continuationKey === null) return found
  }
  throw new Error(`The bank was still naming a next page after ${MAX_PAGES} pages`)
}

function transactionOf_(transaction) {
  return {
    reference: transaction.entry_reference ?? null,
    amount: transaction.transaction_amount.amount,
    currency: transaction.transaction_amount.currency,
    direction: transaction.credit_debit_indicator,
    status: transaction.status,
    bookedOn: transaction.booking_date ?? null,
    valueOn: transaction.value_date ?? null,
    madeOn: transaction.transaction_date ?? null,
    creditorName: transaction.creditor?.name ?? null,
    creditorIban: transaction.creditor_account?.iban ?? null,
    debtorName: transaction.debtor?.name ?? null,
    debtorIban: transaction.debtor_account?.iban ?? null,
    remittance: transaction.remittance_information ?? [],
  }
}

function call_(method, path, body) {
  const response = UrlFetchApp.fetch(API + path, {
    method,
    muteHttpExceptions: true,
    headers: { Authorization: `Bearer ${token_()}`, Accept: 'application/json' },
    ...(body === undefined ? {} : { contentType: 'application/json', payload: JSON.stringify(body) }),
  })
  const status = response.getResponseCode()
  const answer = JSON.parse(response.getContentText() || '{}')
  if (status >= 400) throw new Error(`Enable Banking answered ${status}: ${answer.error ?? ''} ${answer.message ?? ''}`.trim())
  return answer
}

/** A signed token for one call. A JWT takes base64url without padding, which `base64EncodeWebSafe` may add. */
function token_() {
  const properties = PropertiesService.getScriptProperties()
  const applicationId = properties.getProperty('ENABLE_BANKING_APP_ID')
  const privateKey = properties.getProperty('ENABLE_BANKING_PRIVATE_KEY')
  if (!applicationId || !privateKey) throw new Error('Script Properties lack ENABLE_BANKING_APP_ID or ENABLE_BANKING_PRIVATE_KEY')
  const base64 = (data) => Utilities.base64EncodeWebSafe(data).replace(/=+$/, '')
  const now = Math.floor(Date.now() / 1000)
  const signed = [
    base64(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: applicationId })),
    base64(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + TOKEN_SECONDS })),
  ].join('.')
  return `${signed}.${base64(Utilities.computeRsaSha256Signature(signed, privateKey.replace(/\\n/g, '\n')))}`
}
