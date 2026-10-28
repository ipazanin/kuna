import type { InvoiceMail } from '../domain/invoiceMail'

function base64OfBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  }
  return btoa(binary)
}

function base64OfText(text: string): string {
  return base64OfBytes(new TextEncoder().encode(text))
}

/** Base64 in lines of 76, as MIME wants a body. */
function wrapped(base64: string): string {
  return base64.match(/.{1,76}/g)?.join('\r\n') ?? ''
}

/** A header value on one line, in plain ASCII or else as an RFC 2047 encoded word, so a subject with č stays readable. */
function headerText(text: string): string {
  const line = text.replace(/[\r\n]+/g, ' ')
  return /^[\x20-\x7e]*$/.test(line) ? line : `=?UTF-8?B?${base64OfText(line)}?=`
}

/**
 * The mail as one RFC 2822 message with the PDF attached, base64url encoded as the Gmail API's
 * `raw` field takes it.
 */
export function rawInvoiceMessage(mail: InvoiceMail, fileName: string, pdf: Uint8Array): string {
  const boundary = `kuna-${crypto.randomUUID()}`
  const name = headerText(fileName)
  const message = [
    `To: ${headerText(mail.to)}`,
    `Subject: ${headerText(mail.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapped(base64OfText(mail.body.replace(/\r?\n/g, '\r\n'))),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${name}"`,
    `Content-Disposition: attachment; filename="${name}"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapped(base64OfBytes(pdf)),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return base64OfText(message).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
