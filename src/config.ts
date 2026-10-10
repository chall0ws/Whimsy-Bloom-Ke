import { parseStaffList } from './domain/auth'

/**
 * Build-time settings. vite.config.ts maps Vercel's Supabase integration names
 * (NEXT_PUBLIC_SUPABASE_URL …) onto these.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ''

/**
 * Live mode: real sign-in, data in Supabase, payments through Paystack.
 * Off until VITE_LIVE=true, so the site keeps working as a demo until the database is set up.
 */
export const LIVE = import.meta.env.VITE_LIVE === 'true' && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Team members by email ("you@gmail.com:SUPER_ADMIN, her@gmail.com:ADMIN"). */
export const CONFIGURED_STAFF = parseStaffList(import.meta.env.VITE_STAFF_EMAILS as string | undefined)
