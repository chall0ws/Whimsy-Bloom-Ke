import { ArrowRight } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { BloomMark, HeartDivider, Logo, Script, Sparkles } from '../components/Logo'
import { Button } from '../components/ui'
import { staffRoleFor } from '../domain/auth'
import { useStore } from '../state/store'
import { CONFIGURED_STAFF, useAuth } from './AuthProvider'
import { GoogleButton } from './GoogleButton'

/** The dashboard role of whoever is signed in, or null if they aren't on the team. */
export function useStaffRole() {
  const { account } = useAuth()
  const { state } = useStore()
  return account ? staffRoleFor(account.email, CONFIGURED_STAFF, state.users) : null
}

/** Lets only team members into the dashboard. */
export function StaffGate({ children }: { children: ReactNode }) {
  const { account, loading } = useAuth()
  const { state, dispatch } = useStore()
  const role = useStaffRole()
  const current = state.users.find((u) => u.id === state.currentUserId)
  const ready = Boolean(account && role && current && current.email.toLowerCase() === account.email.toLowerCase() && current.role === role)

  useEffect(() => {
    if (account && role && !ready) dispatch({ type: 'SIGN_IN_STAFF', email: account.email, name: account.name, role })
  }, [account, role, ready, dispatch])

  if (loading || (account && role && !ready)) return <Centered>{null}</Centered>
  if (!account) return <StaffSignIn />
  if (!role) return <NotOnTeam email={account.email} />
  return <>{children}</>
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function StaffSignIn() {
  const { signInWithGoogle, mode } = useAuth()
  return (
    <Centered>
      <div className="relative rounded-b-3xl rounded-t-[180px] border border-line-strong bg-surface px-8 pb-8 pt-12 text-center shadow-card">
        <Sparkles className="absolute left-6 top-24 w-12" />
        <Sparkles className="absolute right-5 top-36 w-10 -scale-x-100" />
        <Logo className="justify-center" />
        <Script className="mt-8 block text-4xl leading-none">Welcome back</Script>
        <h1 className="font-display text-3xl font-semibold text-green-ink">Team sign-in</h1>
        <HeartDivider className="mx-auto mt-3 w-40" />
        <p className="mt-3 text-sm text-ink-2">Sign in with the Google account the Whimsy &amp; Bloom team uses.</p>
        <div className="mt-6">
          <GoogleButton onClick={() => signInWithGoogle(window.location.hash || '#/')} />
        </div>
        {mode === 'demo' && (
          <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
            Demo mode: Google login isn’t switched on yet, so you pick a demo account. The setup guide is in <code>docs/google-login.md</code>.
          </p>
        )}
      </div>
      <a href="#/portal" className="mt-5 flex items-center justify-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
        Shopping with us? Go to the client portal <ArrowRight size={14} aria-hidden />
      </a>
    </Centered>
  )
}

function NotOnTeam({ email }: { email: string }) {
  const { signOut, signInWithGoogle } = useAuth()
  return (
    <Centered>
      <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
        <BloomMark size={48} className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-semibold">This account isn’t on the team</h1>
        <p className="mt-2 text-sm text-muted">
          <strong className="text-ink">{email}</strong> can’t open the dashboard. If you’re a customer, your orders are in the client portal.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a href="#/portal" className="inline-flex h-11 items-center justify-center rounded-full bg-green px-5 text-sm font-medium text-on-green">
            Go to the client portal
          </a>
          <Button
            variant="ghost"
            onClick={async () => {
              await signOut()
              signInWithGoogle('#/')
            }}
          >
            Use a different Google account
          </Button>
        </div>
      </div>
    </Centered>
  )
}
