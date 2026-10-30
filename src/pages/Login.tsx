import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = email.trim().toLowerCase()
    if (!clean.includes('@')) return setError('Please enter a valid email address.')
    setBusy(true)
    const { data: allowed, error: checkErr } = await supabase.rpc('email_allowed', { p_email: clean })
    if (checkErr) {
      setBusy(false)
      return setError('Could not reach the server. Please try again in a moment.')
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
              📬 Check <b>{email}</b>. Tap the link in the email and you're in. No password needed.
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
