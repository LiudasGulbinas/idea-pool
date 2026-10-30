import { useCallback, useEffect, useRef, useState } from 'react'
import { startAnalysis, scoreColor } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { timeAgo, type Analysis, type Member } from '../lib/types'
import { Avatar } from './Avatar'

export function AnalysisPanel({ ideaId }: { ideaId: string }) {
  const { member } = useAuth()
  const [a, setA] = useState<Analysis | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const kicked = useRef(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ai_analysis').select('*').eq('idea_id', ideaId).maybeSingle()
    setA(data as Analysis | null)
  }, [ideaId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`analysis-${ideaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_analysis', filter: `idea_id=eq.${ideaId}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [ideaId, load])

  // If an analysis is queued but nobody started it (e.g. the author closed the app right away), start it now.
  useEffect(() => {
    if (a?.status === 'pending' && !kicked.current && Date.now() - new Date(a.updated_at).getTime() > 20_000) {
      kicked.current = true
      startAnalysis(ideaId)
    }
  }, [a, ideaId])

  async function run(force: boolean) {
    setError(null)
    const err = await startAnalysis(ideaId, { force })
    if (err) setError(err)
    load()
  }

  const isAdmin = member?.role === 'admin'
  if (a === undefined) return null

  const busy = !a || a.status === 'pending' || a.status === 'running'
  const hasResult = a?.analysed_at && a.criteria

  return (
    <section className="card space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🤖 Investor analysis</h2>
          {a?.analysed_at && <p className="text-xs text-slate-500">by Claude · {timeAgo(a.analysed_at)}</p>}
        </div>
        {hasResult && a.overall_score != null && (
          <div className={`rounded-2xl px-4 py-2 text-center ${scoreColor(a.overall_score)}`}>
            <div className="text-2xl leading-none font-extrabold">{Number(a.overall_score).toFixed(1)}</div>
            <div className="text-[10px] font-semibold tracking-wide uppercase">of 5</div>
          </div>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-700">
          <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
          <span>Claude is analysing{hasResult ? ' the latest version' : ''}: searching the web for competitors and scoring it for investors. This usually takes 1–2 minutes and appears here automatically.</span>
        </div>
      )}

      {a?.status === 'failed' && (
        <div className="space-y-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p><b>The analysis failed.</b> {a.error}</p>
          <button className="btn-ghost py-1.5 text-sm" onClick={() => run(false)}>Try again</button>
        </div>
      )}

      {hasResult && (
        <>
          {a.verdict && <p className="rounded-xl bg-slate-50 p-4 text-slate-800">{a.verdict}</p>}

          <div className="space-y-3">
            {a.criteria!.map((c) => (
              <details key={c.key} className="group rounded-xl border border-slate-100 px-3 py-2 open:bg-slate-50">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="flex gap-0.5" aria-label={`${c.score ?? '?'} of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2.5 w-5 rounded-full ${c.score != null && n <= c.score ? (c.score >= 4 ? 'bg-green-500' : c.score >= 3 ? 'bg-amber-400' : 'bg-red-400') : 'bg-slate-200'}`} />
                    ))}
                  </span>
                  <span className="w-4 text-right text-sm font-bold">{c.score ?? '–'}</span>
                  <span className="text-slate-400 transition group-open:rotate-90">›</span>
                </summary>
                <p className="mt-2 text-sm text-slate-700">{c.explanation}</p>
              </details>
            ))}
          </div>

          {!!a.similar_companies?.length && (
            <div>
              <h3 className="mb-2 font-semibold">🔎 Similar companies found online</h3>
              <ul className="space-y-2">
                {a.similar_companies.map((c) => (
                  <li key={c.url} className="text-sm">
                    <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">{c.name}</a>
                    <span className="text-slate-600"> · {c.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!a.recommendations?.length && (
            <div>
              <h3 className="mb-2 font-semibold">💡 How to make it stronger</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {a.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}

          {!!a.investor_questions?.length && (
            <div>
              <h3 className="mb-2 font-semibold">❓ Questions investors will ask</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {a.investor_questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      {isAdmin && !busy && (
        <div className="border-t border-slate-100 pt-4">
          <button className="btn-ghost text-sm" onClick={() => confirm('Run a fresh analysis with web search? (costs ~10–20 cents)') && run(true)}>
            🔄 Re-run analysis
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}

export function TeamFitPanel({ ideaId }: { ideaId: string }) {
  const [fit, setFit] = useState<Analysis['team_fit'] | undefined>(undefined)
  const [people, setPeople] = useState<Record<string, Pick<Member, 'display_name' | 'email' | 'avatar_color' | 'avatar_url'>>>({})

  const load = useCallback(async () => {
    const { data } = await supabase.from('ai_analysis').select('team_fit').eq('idea_id', ideaId).maybeSingle()
    setFit((data?.team_fit as Analysis['team_fit']) ?? null)
  }, [ideaId])

  useEffect(() => {
    load()
    supabase
      .from('members')
      .select('id, display_name, email, avatar_color, avatar_url')
      .then(({ data }) => setPeople(Object.fromEntries(((data ?? []) as Member[]).map((m) => [m.id, m]))))
    const channel = supabase
      .channel(`teamfit-${ideaId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_analysis', filter: `idea_id=eq.${ideaId}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [ideaId, load])

  if (!fit) return null
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-lg font-bold">👥 Team fit</h2>
      {fit.members.length === 0 ? (
        <p className="text-sm text-slate-500">No profiles to match yet. Ask teammates to upload their LinkedIn PDF on the <b>Me</b> tab.</p>
      ) : (
        <ul className="space-y-3">
          {fit.members.map((m) => (
            <li key={m.member_id} className="flex gap-3">
              <span className="mt-0.5">
                <Avatar member={people[m.member_id] ?? { display_name: m.name, email: m.name, avatar_color: '#6366f1', avatar_url: null }} size={36} />
              </span>
              <div>
                <div className="font-semibold">{m.name} <span className="ml-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{m.role}</span></div>
                <p className="text-sm text-slate-600">{m.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {fit.gaps.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-500 uppercase">Gaps to cover</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{fit.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
      )}
    </section>
  )
}
