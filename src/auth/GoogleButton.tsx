import { useState } from 'react'
import { Button, Field, inputClass, Modal } from '../components/ui'

export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function GoogleButton({ onClick, label = 'Continue with Google' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface px-5 text-[15px] font-medium text-ink shadow-sm transition-colors hover:bg-surface-2"
    >
      <GoogleLogo />
      {label}
    </button>
  )
}

type DemoGoogleAccount = { name: string; email: string }

const DEMO_ACCOUNTS: (DemoGoogleAccount & { note: string })[] = [
  { name: 'Partner', email: 'partner@example.com', note: 'Team · super admin' },
  { name: 'Owner', email: 'owner@example.com', note: 'Team · admin' },
  { name: 'Faith Njeri', email: 'faith.njeri@example.com', note: 'Customer with past orders' },
]

/** Stands in for Google's own account picker until Google login is switched on. */
export function DemoGoogleChooser({ onChoose, onCancel }: { onChoose: (account: DemoGoogleAccount) => void; onCancel: () => void }) {
  const [other, setOther] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal
      open
      onClose={onCancel}
      title={
        <span className="flex items-center gap-2">
          <GoogleLogo size={22} /> Choose an account
        </span>
      }
      subtitle="Demo sign-in. With Google login switched on, this is Google’s own screen."
    >
      {!other ? (
        <ul className="-mx-2 divide-y divide-line">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button type="button" onClick={() => onChoose(a)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-wash font-semibold text-pink-ink">{a.name[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted">{a.email}</span>
                </span>
                <span className="text-[11px] text-muted">{a.note}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setOther(true)} className="w-full rounded-xl px-2 py-3 text-left text-sm font-medium text-ink-2 hover:bg-surface-2">
              Use another account
            </button>
          </li>
        </ul>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return setError('Add a name.')
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Add a valid email address.')
            onChoose({ name: name.trim(), email: email.trim().toLowerCase() })
          }}
        >
          <Field label="Name">
            <input id="demo-google-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Email">
            <input id="demo-google-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-red-ink">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOther(false)}>
              Back
            </Button>
            <Button type="submit" variant="primary">
              Sign in
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
