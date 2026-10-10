import { CircleCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, cx, Field, inputClass, Segmented } from '../components/ui'
import { useAuth } from './AuthProvider'
import { GoogleButton } from './GoogleButton'

type Mode = 'signup' | 'signin'

/**
 * Google or email-and-password, in one place. Used at checkout, after a guest order,
 * in My account and on the team sign-in screen.
 */
export function AuthPanel({
  returnTo,
  defaultMode = 'signup',
  googleLabel = 'Continue with Google',
  onSignedIn,
  className,
  footer,
}: {
  returnTo: string
  defaultMode?: Mode
  googleLabel?: string
  /** Called after an email sign-up or sign-in succeeds (Google sign-in reloads the page instead). */
  onSignedIn?: () => void
  className?: string
  footer?: ReactNode
}) {
  const { signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset, mode: authMode } = useAuth()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    const result = mode === 'signup' ? await signUpWithEmail(name, email, password) : await signInWithEmail(email, password)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    if (result.needsConfirmation) return setNotice(`Almost there! We sent a link to ${email.trim()}. Open it to finish creating your account.`)
    onSignedIn?.()
  }

  return (
    <div className={cx('space-y-4', className)}>
      <GoogleButton label={googleLabel} onClick={() => signInWithGoogle(returnTo)} />
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line-strong" /> or use your email <span className="h-px flex-1 bg-line-strong" />
      </div>
      <Segmented
        label="Account"
        value={mode}
        onChange={(m) => {
          setMode(m)
          setError('')
          setNotice('')
        }}
        options={[
          { value: 'signup', label: 'Create account' },
          { value: 'signin', label: 'Sign in' },
        ]}
      />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {mode === 'signup' && (
          <Field label="Your name">
            <input id="auth-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input id="auth-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
          <input
            id="auth-password"
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </Field>
        {error && <p className="text-sm font-medium text-red-ink">{error}</p>}
        {notice && (
          <p className="flex gap-2 rounded-xl bg-green-wash px-3 py-2 text-sm text-green-ink">
            <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> {notice}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
        {mode === 'signin' && (
          <button
            type="button"
            className="block w-full text-center text-xs font-medium text-ink-2 hover:text-ink"
            onClick={async () => {
              const r = await sendPasswordReset(email)
              if (r.ok) setNotice('If there’s an account for that email, a reset link is on its way.')
              else setError(r.error)
            }}
          >
            Forgot your password?
          </button>
        )}
      </form>
      {authMode === 'demo' && (
        <p className="text-center text-[11px] text-muted">Demo mode: accounts are pretend and stay in this browser.</p>
      )}
      {footer}
    </div>
  )
}
