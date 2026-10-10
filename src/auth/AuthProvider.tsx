import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Field, inputClass, Modal } from '../components/ui'
import { parseStaffList } from '../domain/auth'
import { DemoGoogleChooser } from './GoogleButton'

/** The account someone is signed in with. Whether they're team or a customer is decided from the email. */
export interface Account {
  email: string
  name: string
  picture?: string
  provider: 'google' | 'email'
  /** Google accounts, and email accounts whose address has been confirmed. Only these can open the dashboard. */
  verified: boolean
}

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string }

interface Auth {
  /** "live" when Supabase is configured; "demo" otherwise (pretend accounts kept in this browser). */
  mode: 'live' | 'demo'
  account: Account | null
  loading: boolean
  /** `returnTo` is the page to land on after signing in, e.g. "#/checkout". */
  signInWithGoogle: (returnTo: string) => void
  signUpWithEmail: (name: string, email: string, password: string) => Promise<AuthResult>
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>
  sendPasswordReset: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const RETURN_KEY = 'whimsy-bloom:after-sign-in'
const DEMO_SESSION_KEY = 'whimsy-bloom:demo-session'
const DEMO_ACCOUNTS_KEY = 'whimsy-bloom:demo-accounts'

/** Team members by email, from VITE_STAFF_EMAILS ("you@gmail.com:SUPER_ADMIN, her@gmail.com:ADMIN"). */
export const CONFIGURED_STAFF = parseStaffList(import.meta.env.VITE_STAFF_EMAILS as string | undefined)
export const LIVE_LOGIN_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY)

const AuthContext = createContext<Auth | null>(null)

let client: Promise<SupabaseClient> | null = null
function supabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      // PKCE returns "?code=…" rather than tokens in the "#", which the hash-based page links need.
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    }),
  )
  return client
}

function fromSupabase(user: SupabaseUser | null | undefined): Account | null {
  if (!user?.email) return null
  const meta = user.user_metadata as Record<string, string | undefined>
  const provider = user.app_metadata?.provider === 'google' ? 'google' : 'email'
  return {
    email: user.email,
    name: meta.full_name ?? meta.name ?? user.email.split('@')[0],
    picture: meta.avatar_url,
    provider,
    verified: provider === 'google' || Boolean(user.email_confirmed_at),
  }
}

const EMAIL = /^\S+@\S+\.\S+$/

function checkCredentials(email: string, password: string, name?: string): string | null {
  if (name !== undefined && !name.trim()) return 'Please add your name.'
  if (!EMAIL.test(email.trim())) return 'Please enter a valid email address.'
  if (password.length < 8) return 'Use at least 8 characters for your password.'
  return null
}

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first. Check your inbox for the link.'
  if (/already registered|already exists/i.test(message)) return 'There’s already an account with that email. Sign in instead.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.'
  return message
}

// Demo mode keeps pretend email accounts in this browser only, with hashed passwords.
type DemoAccounts = Record<string, { name: string; hash: string }>

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Without storage the demo account lasts until the page is closed.
  }
}

async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`whimsy-bloom:${email}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function goToSavedPage() {
  try {
    const target = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    if (target) window.location.hash = target
  } catch {
    // Stay on the current page.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = LIVE_LOGIN_CONFIGURED ? 'live' : 'demo'
  const [account, setAccount] = useState<Account | null>(() => (mode === 'demo' ? readJson<Account | null>(DEMO_SESSION_KEY, null) : null))
  const [loading, setLoading] = useState(mode === 'live')
  const [chooserFor, setChooserFor] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (mode !== 'live') return
    let unsubscribe = () => {}
    supabase().then((sb) => {
      sb.auth.getSession().then(({ data }) => {
        setAccount(fromSupabase(data.session?.user))
        setLoading(false)
        if (data.session) {
          // Back from Google or an email link: tidy the "?code=" off the address and go where they were heading.
          if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
          goToSavedPage()
        }
      })
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        setAccount(fromSupabase(session?.user))
        setLoading(false)
        if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      })
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => unsubscribe()
  }, [mode])

  const signInDemo = useCallback((next: Account) => {
    writeJson(DEMO_SESSION_KEY, next)
    setAccount(next)
  }, [])

  const signInWithGoogle = useCallback(
    (returnTo: string) => {
      if (mode === 'demo') {
        setChooserFor(returnTo)
        return
      }
      try {
        sessionStorage.setItem(RETURN_KEY, returnTo)
      } catch {
        // They'll land on the home page instead.
      }
      supabase().then((sb) =>
        sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } },
        }),
      )
    },
    [mode],
  )

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      const problem = checkCredentials(email, password, name)
      if (problem) return { ok: false, error: problem }
      const address = email.trim().toLowerCase()
      if (mode === 'demo') {
        const accounts = readJson<DemoAccounts>(DEMO_ACCOUNTS_KEY, {})
        if (accounts[address]) return { ok: false, error: 'There’s already an account with that email. Sign in instead.' }
        accounts[address] = { name: name.trim(), hash: await hashPassword(address, password) }
        writeJson(DEMO_ACCOUNTS_KEY, accounts)
        signInDemo({ email: address, name: name.trim(), provider: 'email', verified: false })
        return { ok: true }
      }
      const { data, error } = await (await supabase()).auth.signUp({
        email: address,
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + window.location.pathname },
      })
      if (error) return { ok: false, error: friendlyError(error.message) }
      // With "Confirm email" on, Supabase sends a link and there's no session until it's clicked.
      return { ok: true, needsConfirmation: !data.session }
    },
    [mode, signInDemo],
  )

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const problem = checkCredentials(email, password)
      if (problem) return { ok: false, error: problem }
      const address = email.trim().toLowerCase()
      if (mode === 'demo') {
        const found = readJson<DemoAccounts>(DEMO_ACCOUNTS_KEY, {})[address]
        if (!found || found.hash !== (await hashPassword(address, password))) return { ok: false, error: 'That email and password don’t match.' }
        signInDemo({ email: address, name: found.name, provider: 'email', verified: false })
        return { ok: true }
      }
      const { error } = await (await supabase()).auth.signInWithPassword({ email: address, password })
      return error ? { ok: false, error: friendlyError(error.message) } : { ok: true }
    },
    [mode, signInDemo],
  )

  const sendPasswordReset = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!EMAIL.test(email.trim())) return { ok: false, error: 'Enter your email address first.' }
      if (mode === 'demo') return { ok: false, error: 'Password reset emails work once real sign-in is switched on.' }
      const { error } = await (await supabase()).auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname })
      return error ? { ok: false, error: friendlyError(error.message) } : { ok: true }
    },
    [mode],
  )

  const signOut = useCallback(async () => {
    if (mode === 'live') await (await supabase()).auth.signOut()
    writeJson(DEMO_SESSION_KEY, null)
    setAccount(null)
  }, [mode])

  const value = useMemo<Auth>(
    () => ({ mode, account, loading, signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset, signOut }),
    [mode, account, loading, signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset, signOut],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {chooserFor !== null && (
        <DemoGoogleChooser
          onCancel={() => setChooserFor(null)}
          onChoose={(chosen) => {
            signInDemo({ ...chosen, provider: 'google', verified: true })
            window.location.hash = chooserFor
            setChooserFor(null)
          }}
        />
      )}
      {recovering && <NewPasswordDialog onDone={() => setRecovering(false)} />}
    </AuthContext.Provider>
  )
}

/** Shown after someone follows a password-reset link. */
function NewPasswordDialog({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal
      open
      onClose={onDone}
      title="Choose a new password"
      footer={
        <Button
          variant="primary"
          onClick={async () => {
            if (password.length < 8) return setError('Use at least 8 characters.')
            const { error: e } = await (await supabase()).auth.updateUser({ password })
            if (e) return setError(friendlyError(e.message))
            onDone()
          }}
        >
          Save password
        </Button>
      }
    >
      <Field label="New password">
        <input id="new-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </Field>
      {error && <p className="mt-2 text-sm text-red-ink">{error}</p>}
    </Modal>
  )
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside AuthProvider')
  return auth
}
