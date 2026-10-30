import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Spinner } from '../components/Spinner'
import { VoteStepper } from '../components/VoteStepper'
import { scoreColor } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { memberName } from '../lib/types'
import { setVote, useMyVotes, useShortlist, type RankedIdea } from '../lib/useShortlist'

/** Full-screen ranked shortlist for group meetings, with live voting and picking the winner. */
export function Meeting() {
  const { member } = useAuth()
  const { ideas, settings, reload } = useShortlist()
  const { mine, left } = useMyVotes(ideas, settings.vote_budget, member?.id)
  const [focus, setFocus] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const isAdmin = member?.role === 'admin'
  const total = ideas?.length ?? 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (focus === null || !total) return
      if (e.key === 'ArrowRight') setFocus((f) => ((f ?? 0) + 1) % total)
      if (e.key === 'ArrowLeft') setFocus((f) => ((f ?? 0) - 1 + total) % total)
      if (e.key === 'Escape') setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, total])

  async function vote(idea: RankedIdea, points: number) {
    setMsg(null)
    const err = await setVote(idea.id, member!.id, points)
    if (err) setMsg(err)
    reload()
  }

  async function toggleVoting() {
    const { error } = await supabase.from('settings').update({ voting_open: !settings.voting_open }).eq('id', 1)
    if (error) setMsg(error.message)
  }

  async function chooseWinner(idea: RankedIdea) {
    if (!confirm(`Choose "${idea.title}" as the idea we pitch?`)) return
    const { error } = await supabase.from('ideas').update({ status: 'chosen' }).eq('id', idea.id)
    if (error) return setMsg(error.message)
    setCelebrate(true)
    setTimeout(() => setCelebrate(false), 4000)
  }

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const current = focus !== null && ideas ? ideas[focus] : null

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
        <Link to="/shortlist" className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10">✕ Exit</Link>
        <h1 className="text-lg font-extrabold sm:text-2xl">💡 Idea Pool · Meeting</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${settings.voting_open ? 'bg-green-400/20 text-green-300' : 'bg-white/10 text-white/60'}`}>
          {settings.voting_open ? `🗳️ Voting open · you have ${left}/${settings.vote_budget} pts` : '🔒 Voting closed'}
        </span>
        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <button className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20" onClick={toggleVoting}>
              {settings.voting_open ? 'Close voting' : 'Open voting'}
            </button>
          )}
          <button className="hidden rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20 sm:block" onClick={fullscreen}>⛶ Full screen</button>
        </div>
      </header>
      {msg && <p className="mx-4 rounded-xl bg-red-500/20 p-3 text-sm text-red-200 sm:mx-8">{msg}</p>}

      {!ideas && <Spinner />}
      {ideas?.length === 0 && <p className="p-12 text-center text-white/60">Nothing shortlisted yet. Shortlist ideas from their pages first.</p>}

      {ideas && !current && (
        <ol className="grid gap-4 px-4 pb-10 sm:px-8 lg:grid-cols-2">
          {ideas.map((idea, n) => (
            <li key={idea.id}>
              <button onClick={() => setFocus(n)} className="flex w-full gap-4 rounded-2xl bg-white/5 p-5 text-left ring-1 ring-white/10 transition hover:bg-white/10">
                <span className="w-10 shrink-0 text-4xl font-black text-white/30">{idea.status === 'chosen' ? '🏆' : n + 1}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold sm:text-2xl">{idea.title}</h2>
                  <p className="mt-1 text-white/70">{idea.pitch}</p>
                  <Stats idea={idea} />
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}

      {current && (
        <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 sm:px-8">
          <div className="flex items-center justify-between text-white/60">
            <button className="rounded-lg px-3 py-2 hover:bg-white/10" onClick={() => setFocus(null)}>← Ranking</button>
            <span>{focus! + 1} / {total}</span>
            <div className="flex gap-1">
              <button className="rounded-lg px-4 py-2 text-xl hover:bg-white/10" onClick={() => setFocus((focus! - 1 + total) % total)} aria-label="Previous">‹</button>
              <button className="rounded-lg px-4 py-2 text-xl hover:bg-white/10" onClick={() => setFocus((focus! + 1) % total)} aria-label="Next">›</button>
            </div>
          </div>

          <div>
            <div className="text-sm font-bold tracking-widest text-indigo-300 uppercase">{current.status === 'chosen' ? '🏆 Chosen idea' : `#${focus! + 1} on the shortlist`}</div>
            <h2 className="mt-2 text-3xl leading-tight font-black sm:text-5xl">{current.title}</h2>
            <p className="mt-3 text-xl text-white/80 sm:text-2xl">{current.pitch}</p>
            <Stats idea={current} big />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {current.analysis?.verdict && (
              <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 md:col-span-2">
                <h3 className="mb-2 font-bold text-indigo-300">🤖 Claude's verdict</h3>
                <p className="text-white/85">{current.analysis.verdict}</p>
              </section>
            )}
            {!!current.analysis?.criteria?.length && (
              <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <h3 className="mb-3 font-bold text-indigo-300">Scores</h3>
                <ul className="space-y-1.5">
                  {current.analysis.criteria.map((c) => (
                    <li key={c.key} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 text-white/80">{c.name}</span>
                      <span className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((k) => <span key={k} className={`h-2 w-4 rounded-full ${c.score != null && k <= c.score ? 'bg-indigo-400' : 'bg-white/15'}`} />)}
                      </span>
                      <span className="w-4 text-right font-bold">{c.score ?? '–'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!!current.analysis?.team_fit?.members.length && (
              <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <h3 className="mb-3 font-bold text-indigo-300">👥 Team fit</h3>
                <ul className="space-y-2 text-sm">
                  {current.analysis.team_fit.members.map((m) => (
                    <li key={m.member_id}><b>{m.name}</b> <span className="text-indigo-300">· {m.role}</span><div className="text-white/70">{m.reason}</div></li>
                  ))}
                </ul>
                {!!current.analysis.team_fit.gaps.length && <p className="mt-3 text-sm text-white/60">Gaps: {current.analysis.team_fit.gaps.join(', ')}</p>}
              </section>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            {settings.voting_open && current.status === 'shortlisted' ? (
              <>
                <span className="font-semibold">Your vote:</span>
                <VoteStepper dark points={mine(current)} left={left} onChange={(p) => vote(current, p)} />
              </>
            ) : (
              <span className="text-white/60">{current.status === 'chosen' ? 'This is the chosen idea.' : 'Voting is closed.'}</span>
            )}
            <Link to={`/ideas/${current.id}`} className="ml-auto text-sm text-white/60 underline">Full details & comments</Link>
            {isAdmin && current.status !== 'chosen' && (
              <button className="rounded-xl bg-amber-400 px-4 py-2.5 font-bold text-slate-900 hover:bg-amber-300" onClick={() => chooseWinner(current)}>
                🏆 Choose this idea
              </button>
            )}
          </div>
        </div>
      )}

      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="animate-bounce text-center">
            <div className="text-8xl">🏆🎉</div>
            <div className="mt-4 text-4xl font-black">We have our pitch!</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stats({ idea, big }: { idea: RankedIdea; big?: boolean }) {
  return (
    <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${big ? 'text-lg' : 'text-sm'}`}>
      <span><b className={big ? 'text-3xl' : 'text-xl'}>{idea.voteTotal}</b> <span className="text-white/60">pts</span></span>
      {idea.analysis?.overall_score != null && (
        <span className={`rounded-full px-2.5 py-0.5 font-bold ${scoreColor(idea.analysis.overall_score)}`}>🤖 {Number(idea.analysis.overall_score).toFixed(1)}</span>
      )}
      <span className="text-white/70">❤️ {idea.likeCount}</span>
      <span className="flex -space-x-1.5">
        {idea.votes.map((v) => v.member && (
          <span key={v.member_id} className="rounded-full ring-2 ring-indigo-950" title={`${memberName(v.member)}: ${v.points}`}><Avatar member={v.member} size={big ? 30 : 24} /></span>
        ))}
      </span>
    </div>
  )
}
