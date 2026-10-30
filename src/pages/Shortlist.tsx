import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ScoreBadge } from '../components/ScoreBadge'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { VoteStepper } from '../components/VoteStepper'
import { useAuth } from '../lib/auth'
import { memberName } from '../lib/types'
import { setVote, useMyVotes, useShortlist, type RankedIdea } from '../lib/useShortlist'

export function Shortlist() {
  const { member } = useAuth()
  const { ideas, settings, error, reload } = useShortlist()
  const { mine, left } = useMyVotes(ideas, settings.vote_budget, member?.id)
  const [voteError, setVoteError] = useState<string | null>(null)

  async function vote(idea: RankedIdea, points: number) {
    setVoteError(null)
    const err = await setVote(idea.id, member!.id, points)
    if (err) setVoteError(err)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">🏁 Shortlist</h1>
        <Link to="/meeting" className="btn-primary">🎬 Meeting mode</Link>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        {settings.voting_open ? (
          <>
            <span className="text-2xl">🗳️</span>
            <p className="flex-1">
              You have <b className="text-brand-700">{left} of {settings.vote_budget} points</b> left. Spread them across the ideas you'd pitch.
            </p>
          </>
        ) : (
          <p className="flex-1">🔒 Voting is closed. The admin can reopen it in meeting mode.</p>
        )}
      </div>

      {(error || voteError) && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error ?? voteError}</p>}
      {!ideas && !error && <Spinner />}
      {ideas?.length === 0 && (
        <div className="card p-8 text-center text-slate-600">
          <div className="text-5xl">🌱</div>
          <p className="mt-3">Nothing shortlisted yet. The admin shortlists ideas from each idea's page.</p>
        </div>
      )}

      <ol className="space-y-3">
        {ideas?.map((idea, n) => (
          <li key={idea.id}>
            <Link to={`/ideas/${idea.id}`} className="card flex gap-3 p-4 hover:border-brand-300">
              <span className="w-7 shrink-0 text-2xl font-extrabold text-slate-300">{idea.status === 'chosen' ? '🏆' : n + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-start gap-2">
                  <h2 className="flex-1 text-lg leading-snug font-bold">{idea.title}</h2>
                  <ScoreBadge score={idea.analysis?.overall_score} status={idea.analysis?.status} />
                  {idea.status === 'chosen' && <StatusBadge status="chosen" />}
                </div>
                <p className="text-sm text-slate-600">{idea.pitch}</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <b className="text-lg text-slate-900">{idea.voteTotal}</b> pts
                    <span className="flex -space-x-1.5">
                      {idea.votes.map((v) => v.member && <span key={v.member_id} className="rounded-full ring-2 ring-white" title={`${memberName(v.member)}: ${v.points}`}><Avatar member={v.member} size={22} /></span>)}
                    </span>
                    <span>· ❤️ {idea.likeCount}</span>
                  </div>
                  {settings.voting_open && idea.status === 'shortlisted' && (
                    <VoteStepper points={mine(idea)} left={left} onChange={(p) => vote(idea, p)} />
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
