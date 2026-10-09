import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { parseStaffList } from '../domain/auth'
import { DemoGoogleChooser } from './GoogleButton'

/** The Google account someone is signed in with. Whether they're team or a customer is decided from the email. */
export interface Account {
  email: string
  name: string
  picture?: string
}

interface Auth {
  /** "google" when Supabase is configured; "demo" otherwise (a pretend Google account chooser). */
  mode: 'google' | 'demo'
  account: Account | null
  loading: boolean
  /** `returnTo` is the page to land on after signing in, e.g. "#/portal". */
  signInWithGoogle: (returnTo: string) => void
  signOut: () => Promise<void>
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const RETURN_KEY = 'whimsy-bloom:after-sign-in'
const DEMO_SESSION_KEY = 'whimsy-bloom:demo-session'

/** Team members by email, from VITE_STAFF_EMAILS ("you@gmail.com:SUPER_ADMIN, her@gmail.com:ADMIN"). */
export const CONFIGURED_STAFF = parseStaffList(import.meta.env.VITE_STAFF_EMAILS as string | undefined)
export const GOOGLE_LOGIN_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY)

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

function readDemoSession(): Account | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

function writeDemoSession(account: Account | null) {
  try {
    if (account) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(account))
    else localStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    // Without storage the demo sign-in lasts until the page is closed.
  }
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
  const mode = GOOGLE_LOGIN_CONFIGURED ? 'google' : 'demo'
  const [account, setAccount] = useState<Account | null>(() => (mode === 'demo' ? readDemoSession() : null))
  const [loading, setLoading] = useState(mode === 'google')
  const [chooserFor, setChooserFor] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'google') return
    let unsubscribe = () => {}
    supabase().then((sb) => {
      const apply = (user: { email?: string; user_metadata?: Record<string, string> } | null | undefined) => {
        setAccount(user?.email ? { email: user.email, name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email, picture: user.user_metadata?.avatar_url } : null)
        setLoading(false)
      }
      sb.auth.getSession().then(({ data }) => {
        apply(data.session?.user)
        if (data.session) {
          // Back from Google: tidy the "?code=" off the address and go where they were heading.
          if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
          goToSavedPage()
        }
      })
      const { data } = sb.auth.onAuthStateChange((_event, session) => apply(session?.user))
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => unsubscribe()
  }, [mode])

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

  const signOut = useCallback(async () => {
    if (mode === 'google') await (await supabase()).auth.signOut()
    writeDemoSession(null)
    setAccount(null)
  }, [mode])

  const value = useMemo<Auth>(() => ({ mode, account, loading, signInWithGoogle, signOut }), [mode, account, loading, signInWithGoogle, signOut])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {chooserFor !== null && (
        <DemoGoogleChooser
          onCancel={() => setChooserFor(null)}
          onChoose={(chosen) => {
            writeDemoSession(chosen)
            setAccount(chosen)
            window.location.hash = chooserFor
            setChooserFor(null)
          }}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside AuthProvider')
  return auth
}
