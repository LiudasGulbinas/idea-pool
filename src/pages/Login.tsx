import { useState, type FormEvent } from 'react'
import { isStandaloneApp } from '../lib/pwa'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(readRedirectError)
  const standalone = isStandaloneApp()

  async function google() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setError(`Google login is not available: ${error.message}`)
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = email.trim().toLowerCase()
    if (!clean.includes('@')) return setError('Please enter a valid email address.')
    setBusy(true)
    const { data: allowed, error: checkErr } = await supabase.rpc('email_allowed', { p_email: clean })
    if (checkErr) {
      setBusy(false)
      return setError(`Could not reach the server. Please try again in a moment. (Details: ${checkErr.message}${checkErr.code ? ` [${checkErr.code}]` : ''})`)
    }
    if (!allowed) {
      setBusy(false)
      return setError("This email isn't on the group list yet. Ask Liudas to add you.")
    }
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (otpErr) {
      return setError(
        otpErr.status === 429
          ? 'Too many login emails in a short time. Please wait a minute and try again.'
          : `Could not send the email: ${otpErr.message}`,
      )
    }
    setEmail(clean)
    setStep('sent')
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: vErr } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (vErr) setError('That code did not work. Check it, or use the link in the email.')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-50 via-white to-amber-50 px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="text-5xl">💡</div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">Idea Pool</h1>
          <p className="mt-1 text-sm text-slate-500">Startup ideas for our EMBA investor pitch</p>
        </div>

        {step === 'email' && (
          <>
            <button type="button" onClick={google} className="btn-ghost w-full">
              <GoogleIcon /> Continue with Google
            </button>
            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" /> or use any email <div className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}
        {step === 'email' ? (
          <form onSubmit={sendLink} className="space-y-3">
            <label className="label" htmlFor="email">Your email</label>
            <input
              id="email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send me a login link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
              📬 Check <b>{email}</b>.{' '}
              {standalone
                ? 'Type the 6-digit code from the email below (the link would open in your browser, not in this app).'
                : "Tap the link in the email and you're in. No password needed."}
            </div>
            <form onSubmit={verifyCode} className="space-y-3">
              <label className="label" htmlFor="code">…or type the code from the email</label>
              <input
                id="code"
                className="input text-center text-xl tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <button className="btn-primary w-full" disabled={busy || code.length < 6}>
                {busy ? 'Checking…' : 'Log in with code'}
              </button>
            </form>
            <button className="w-full text-sm text-slate-500 underline" onClick={() => { setStep('email'); setCode('') }}>
              Use a different email
            </button>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}

/** Supabase sends login failures back in the URL, e.g. when a Google account is not on the member list. */
function readRedirectError(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
  const desc = params.get('error_description')
  if (!desc) return null
  window.history.replaceState(null, '', window.location.pathname)
  if (/database error|not on the idea pool/i.test(desc))
    return "That Google account's email isn't on the group list. Use the email Liudas added, or ask him to add this one."
  return `Login failed: ${desc}`
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
