/**
 * Server settings from environment variables. Vercel's Supabase integration sets the
 * SUPABASE_* / NEXT_PUBLIC_SUPABASE_* names; the VITE_* names work too.
 */
const pick = (...names: string[]) => names.map((n) => process.env[n]).find((v) => v && v.trim())?.trim()

export function serverEnv() {
  return {
    supabaseUrl: pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'),
    serviceKey: pick('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    paystackSecret: pick('PAYSTACK_SECRET_KEY'),
    staffEmails: pick('VITE_STAFF_EMAILS', 'STAFF_EMAILS'),
    receiptEmail: pick('PAYSTACK_RECEIPT_EMAIL') ?? 'orders@example.com',
    /** WhatsApp alerts to the team: "2547…:apikey, 2547…:apikey" (keys from CallMeBot). */
    alertRecipients: pick('CALLMEBOT_ALERTS'),
    /** The shop's address for links in alerts; worked out from the request if not set. */
    siteUrl: pick('SITE_URL'),
  }
}
