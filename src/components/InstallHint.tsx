import { useEffect, useState } from 'react'
import { isIOS, isPhone, isStandaloneApp } from '../lib/pwa'

const KEY = 'idea-pool-install-hint-dismissed'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

/** On phones, suggests adding Idea Pool to the home screen so it opens like an app and stays logged in. */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (dismissed || isStandaloneApp() || !isPhone()) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* private mode: just hide for now */
    }
  }

  return (
    <div className="card mb-4 flex items-start gap-3 border-brand-100 bg-brand-50 p-4 text-sm">
      <span className="text-2xl">📲</span>
      <div className="flex-1">
        <p className="font-semibold text-brand-700">Tip: add Idea Pool to your home screen</p>
        {prompt ? (
          <button className="btn-primary mt-2 py-1.5 text-sm" onClick={() => prompt.prompt().then(dismiss)}>Install app</button>
        ) : isIOS() ? (
          <p className="mt-1 text-slate-700">In Safari tap <b>Share</b> <span aria-hidden>⬆️</span> → <b>Add to Home Screen</b>. Open it from there and log in once with the code or Google.</p>
        ) : (
          <p className="mt-1 text-slate-700">Open the browser menu <b>⋮</b> → <b>Add to Home screen</b> (or <b>Install app</b>).</p>
        )}
      </div>
      <button onClick={dismiss} className="text-slate-400" aria-label="Dismiss">✕</button>
    </div>
  )
}
