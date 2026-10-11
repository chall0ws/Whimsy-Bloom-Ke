import { formatKES } from './format'

/** A Kenyan phone number in the international form WhatsApp links need ("0712 345 678" → "254712345678"). */
export function whatsappNumber(phone: string | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.length === 9 && /^[17]/.test(digits)) return `254${digits}`
  // Some other country's number already written in full.
  return digits.length >= 10 ? digits : null
}

/** Opens WhatsApp (app or web) with the message typed out, ready to send. */
export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/** The "your order is ready" message, with what's left to pay and where to pay it. */
export function readyMessage(o: {
  firstName: string
  number: string
  summary: string
  /** How it's being delivered, e.g. "Within Nairobi · Rider". */
  delivery: string
  remaining: number
  deliveryFee: number
  balance: number
  payUrl: string
  /** Links to photos of the finished bouquet. */
  photoUrls?: string[]
}): string {
  const lines = [`Hi ${o.firstName}! 🌸 Your Whimsy & Bloom order ${o.number} (${o.summary}) is ready.`, '']
  const photos = o.photoUrls ?? []
  if (photos.length === 1) lines.push(`Here it is: ${photos[0]}`, '')
  if (photos.length > 1) lines.push('Here it is:', ...photos, '')
  if (o.balance > 0) {
    lines.push(
      `Balance to pay: ${formatKES(o.balance)}`,
      `• Remaining 50%: ${formatKES(o.remaining)}`,
      `• Delivery (${o.delivery}): ${formatKES(o.deliveryFee)}`,
      '',
      `Pay with M-Pesa or card here: ${o.payUrl}`,
      '',
      'We’ll send it your way as soon as it’s paid. Thank you!',
    )
  } else {
    lines.push('It’s fully paid, and we’ll send it your way shortly. Thank you!')
  }
  return lines.join('\n')
}
