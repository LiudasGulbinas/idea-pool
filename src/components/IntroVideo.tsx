import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const OPEN_EVENT = 'idea-pool:open-intro'

/** Opens the intro video from anywhere in the app. */
export function openIntro() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** 30-second tour with voice-over: shown once after a member's first login, and on demand afterwards. */
export function IntroVideo() {
  const { member, refreshMember } = useAuth()
  const [open, setOpen] = useState(() => !!member && !member.intro_seen_at)
  const [ended, setEnded] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const show = () => {
      setEnded(false)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  if (!open || !member) return null

  async function close() {
    video.current?.pause()
    setOpen(false)
    if (!member!.intro_seen_at) {
      await supabase.from('members').update({ intro_seen_at: new Date().toISOString() }).eq('id', member!.id)
      refreshMember()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-label="Idea Pool intro video">
      <div className="flex max-h-full w-full max-w-sm flex-col items-center gap-3">
        <div className="text-center text-white">
          <h2 className="text-lg font-bold">👋 Welcome! Here’s Idea Pool in 30 seconds</h2>
        </div>
        <video
          ref={video}
          className="aspect-[9/16] max-h-[72dvh] w-auto max-w-full rounded-2xl bg-black shadow-2xl"
          src="/intro.mp4"
          poster="/intro-poster.jpg"
          controls
          playsInline
          preload="metadata"
          onEnded={() => setEnded(true)}
        >
          <track kind="captions" src="/intro.vtt" srcLang="en" label="English" />
        </video>
        <button className={ended ? 'btn-primary w-full' : 'btn-ghost w-full'} onClick={close}>
          {ended ? "Got it, let's go! 🚀" : member.intro_seen_at ? 'Close' : 'Skip for now'}
        </button>
        <p className="text-xs text-white/60">You can rewatch it any time with ▶ Tour at the top.</p>
      </div>
    </div>
  )
}
