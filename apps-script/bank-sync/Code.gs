/**
 * Calls Enable Banking for Kuna, which runs in a browser and may hold no private key. Kuna calls the five functions below
 * through the Apps Script API. Script Properties hold the application id, the private key and one session id per bank.
 * Nothing a bank answers is stored here, and only `logBankFields`, run by hand, logs anything: names and counts, no values.
 *
 * `psuUserAgent` is the browser's user agent on a fetch a person started. Any such header tells the bank the person is
 * there, which lifts the limit of four unattended reads a day.
 */

const API = 'https://api.enablebanking.com'
const COUNTRY = 'HR'
const TOKEN_SECONDS = 3600
const SESSION_PREFIX = 'SESSION '
const MAX_PAGES = 500
const DAYS_LOGGED = 89
const EDITOR_USER_AGENT = 'Kuna bank sync script editor'

/** The fixed codes `logBankFields` counts by name. Anything else counts as other, so no text from a bank reaches the log. */
const LOGGED_CODES = {
  status: ['BOOK', 'PDNG', 'HOLD', 'CNCL', 'OTHR', 'RJCT', 'SCHD'],
  credit_debit_indicator: ['CRDT', 'DBIT'],
  balance_type: ['CLAV', 'CLBD', 'FWAV', 'INFO', 'ITAV', 'ITBD', 'OPAV', 'OPBD', 'OTHR', 'PRCD', 'VALU', 'XPCD'],
  cash_account_type: ['CACC', 'CARD', 'CASH', 'LOAN', 'OTHR', 'SVGS'],
}

/** Starts a bank's approval for as long as the bank allows, and says where to send the tab. */
function startLink(bank, redirectUrl, state) {
  const aspsp = call_('get', `/aspsps?country=${COUNTRY}`).aspsps.find((candidate) => candidate.name === bank)
  if (aspsp === undefined) throw new Error(`Enable Banking lists no ${bank} in ${COUNTRY}`)
  const validUntil = new Date(Date.now() + (aspsp.maximum_consent_validity - 60) * 1000).toISOString()
  const started = call_('post', '/auth', { body: { access: { valid_until: validUntil }, aspsp: { name: bank, country: COUNTRY }, state, redirect_url: redirectUrl, psu_type: 'personal' } })
  return { url: started.url }
}

/** Trades the code the bank came back with for a session, and keeps only the session's id. The session it replaces is closed, since nothing could reach it afterwards. */
function finishLink(code) {
  const session = call_('post', '/sessions', { body: { code } })
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
function accounts(psuUserAgent) {
  const properties = PropertiesService.getScriptProperties().getProperties()
  return Object.keys(properties)
    .filter((key) => key.startsWith(SESSION_PREFIX))
    .map((key) => {
      const bank = key.slice(SESSION_PREFIX.length)
      try {
        const session = call_('get', `/sessions/${properties[key]}`)
        return { bank, status: session.status, accounts: session.status === 'AUTHORIZED' ? session.accounts.map((uid) => accountOf_(uid, psuUserAgent)) : [] }
      } catch (failure) {
        return { bank, status: 'FAILED', reason: failure.message, accounts: [] }
      }
    })
}

/** What Kuna drafts an account from. Never `name`, which Enable Banking fills with the holder's own name. */
function accountOf_(uid, psuUserAgent) {
  const details = call_('get', `/accounts/${uid}/details`, { psuUserAgent })
  return {
    uid,
    iban: details.account_id?.iban ?? '',
    currency: details.currency,
    product: details.product ?? null,
    details: details.details ?? null,
    cashAccountType: details.cash_account_type ?? null,
    usage: details.usage ?? null,
    identificationHash: details.identification_hash ?? null,
  }
}

/** Every page of an account's transactions from the day. A page may be empty and still name a next one, so only a missing key ends the list. */
function transactions(accountUid, from, strategy, psuUserAgent) {
  return bankRows_(accountUid, from, strategy, psuUserAgent).map(transactionOf_)
}

function bankRows_(accountUid, from, strategy, psuUserAgent) {
  const found = []
  let continuationKey = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = [`date_from=${from}`, `strategy=${strategy}`, ...(continuationKey === null ? [] : [`continuation_key=${encodeURIComponent(continuationKey)}`])]
    const answer = call_('get', `/accounts/${accountUid}/transactions?${query.join('&')}`, { psuUserAgent })
    found.push(...(answer.transactions ?? []))
    continuationKey = answer.continuation_key ?? null
    if (continuationKey === null) return found
  }
  throw new Error(`The bank was still naming a next page after ${MAX_PAGES} pages`)
}

/** What the bank says an account holds, one line for each kind of balance it keeps. */
function balances(accountUid, psuUserAgent) {
  return (call_('get', `/accounts/${accountUid}/balances`, { psuUserAgent }).balances ?? []).map((balance) => ({
    amount: balance.balance_amount?.amount ?? '',
    currency: balance.balance_amount?.currency ?? '',
    type: balance.balance_type ?? '',
  }))
}

function transactionOf_(transaction) {
  return {
    reference: transaction.entry_reference ?? null,
    amount: transaction.transaction_amount?.amount ?? '',
    currency: transaction.transaction_amount?.currency ?? '',
    direction: transaction.credit_debit_indicator ?? '',
    status: transaction.status,
    bookedOn: transaction.booking_date ?? null,
    valueOn: transaction.value_date ?? null,
    madeOn: transaction.transaction_date ?? null,
    creditorName: transaction.creditor?.name ?? null,
    creditorIban: transaction.creditor_account?.iban ?? null,
    debtorName: transaction.debtor?.name ?? null,
    debtorIban: transaction.debtor_account?.iban ?? null,
    remittance: transaction.remittance_information ?? [],
    exchangeRate: transaction.exchange_rate?.exchange_rate ?? null,
  }
}

/**
 * Run this from the script editor once a bank is linked. For each linked account it logs the names of the fields Enable
 * Banking returns and how many records carry each, for the last 89 days. It never logs an amount, a name, an IBAN, an id or
 * any text from a bank, only counts and the fixed codes in `LOGGED_CODES`.
 */
function logBankFields() {
  const properties = PropertiesService.getScriptProperties().getProperties()
  Object.keys(properties)
    .filter((key) => key.startsWith(SESSION_PREFIX))
    .forEach((key) => {
      const bank = key.slice(SESSION_PREFIX.length)
      const session = call_('get', `/sessions/${properties[key]}`)
      Logger.log(`${bank} session: ${JSON.stringify(fieldCounts_([session]))}`)
      ;(session.accounts ?? []).forEach((uid, place) => logAccountFields_(`${bank} account ${place + 1}`, uid))
    })
}

function logAccountFields_(label, uid) {
  const options = { psuUserAgent: EDITOR_USER_AGENT }
  const details = call_('get', `/accounts/${uid}/details`, options)
  const balanceRows = call_('get', `/accounts/${uid}/balances`, options).balances ?? []
  const from = new Date(Date.now() - DAYS_LOGGED * 86400000).toISOString().slice(0, 10)
  const rows = bankRows_(uid, from, 'default', EDITOR_USER_AGENT)
  Logger.log(
    `${label} details: ${JSON.stringify({ singleCurrency: details.currency !== 'XXX', hasIban: Boolean(details.account_id?.iban), fields: fieldCounts_([details]), codes: codeCounts_([details]) })}`,
  )
  Logger.log(`${label} balances: ${JSON.stringify({ count: balanceRows.length, fields: fieldCounts_(balanceRows), codes: codeCounts_(balanceRows) })}`)
  Logger.log(`${label} transactions: ${JSON.stringify({ count: rows.length, fields: fieldCounts_(rows), codes: codeCounts_(rows), days: dayCounts_(rows) })}`)
}

/** How many of the records carry each field, nested fields as `parent.child` and lists as `name[]`, with empty fields left out. */
function fieldCounts_(records) {
  const counts = {}
  const count = (name, field) => {
    if (field === null || field === undefined || field === '') return
    if (Array.isArray(field)) field.forEach((inList) => count(`${name}[]`, inList))
    else if (typeof field === 'object') Object.keys(field).forEach((inner) => count(`${name}.${inner}`, field[inner]))
    else counts[name] = (counts[name] ?? 0) + 1
  }
  records.forEach((record) => Object.keys(record).forEach((name) => count(name, record[name])))
  return counts
}

/** How many records hold each fixed code, as `status BOOK`. */
function codeCounts_(records) {
  const counts = {}
  records.forEach((record) =>
    Object.keys(LOGGED_CODES)
      .filter((field) => record[field] !== undefined && record[field] !== null)
      .forEach((field) => {
        const name = `${field} ${LOGGED_CODES[field].includes(record[field]) ? record[field] : 'other'}`
        counts[name] = (counts[name] ?? 0) + 1
      }),
  )
  return counts
}

/** How the rows' days are written: how many carry a time, and how many were made on another day than they booked. */
function dayCounts_(rows) {
  const withTime = (field) => rows.filter((row) => String(row[field] ?? '').includes('T')).length
  const madeOnAnotherDay = rows.filter((row) => row.transaction_date && row.booking_date && String(row.transaction_date).slice(0, 10) !== String(row.booking_date).slice(0, 10)).length
  return { bookingDateWithTime: withTime('booking_date'), transactionDateWithTime: withTime('transaction_date'), valueDateWithTime: withTime('value_date'), madeOnAnotherDay }
}

function call_(method, path, { body, psuUserAgent } = {}) {
  const response = UrlFetchApp.fetch(API + path, {
    method,
    muteHttpExceptions: true,
    headers: { Authorization: `Bearer ${token_()}`, Accept: 'application/json', ...(psuUserAgent ? { 'Psu-User-Agent': psuUserAgent } : {}) },
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
