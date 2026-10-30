import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { IDEA_SELECT, type Analysis, type Idea, type Vote, type VotingSettings } from './types'

export interface RankedIdea extends Idea {
  votes: Vote[]
  voteTotal: number
  likeCount: number
  analysis: Pick<Analysis, 'status' | 'overall_score' | 'verdict' | 'criteria' | 'team_fit'> | null
}

const VOTE_SELECT = 'idea_id, member_id, points, member:members!votes_member_id_fkey(display_name, email, avatar_color)'

/** Shortlisted and chosen ideas ranked by votes, then AI score, then likes; updates live. */
export function useShortlist() {
  const [ideas, setIdeas] = useState<RankedIdea[] | null>(null)
  const [settings, setSettings] = useState<VotingSettings>({ vote_budget: 5, voting_open: true })
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [ideasRes, votesRes, likesRes, analysisRes, settingsRes] = await Promise.all([
      supabase.from('ideas').select(IDEA_SELECT).in('status', ['shortlisted', 'chosen']),
      supabase.from('votes').select(VOTE_SELECT),
      supabase.from('likes').select('idea_id'),
      supabase.from('ai_analysis').select('idea_id, status, overall_score, verdict, criteria, team_fit'),
      supabase.from('settings').select('vote_budget, voting_open').eq('id', 1).single(),
    ])
    const err = ideasRes.error ?? votesRes.error
    if (err) return setError(err.message)
    if (settingsRes.data) setSettings(settingsRes.data as VotingSettings)
    const votes = votesRes.data as unknown as Vote[]
    const likes = (likesRes.data ?? []) as { idea_id: string }[]
    const analyses = (analysisRes.data ?? []) as (RankedIdea['analysis'] & { idea_id: string })[]
    const ranked = (ideasRes.data as Idea[]).map((i) => {
      const v = votes.filter((x) => x.idea_id === i.id)
      return {
        ...i,
        votes: v,
        voteTotal: v.reduce((s, x) => s + x.points, 0),
        likeCount: likes.filter((l) => l.idea_id === i.id).length,
        analysis: analyses.find((a) => a.idea_id === i.id) ?? null,
      }
    })
    ranked.sort(
      (a, b) =>
        Number(b.status === 'chosen') - Number(a.status === 'chosen') ||
        b.voteTotal - a.voteTotal ||
        (b.analysis?.overall_score ?? -1) - (a.analysis?.overall_score ?? -1) ||
        b.likeCount - a.likeCount,
    )
    setError(null)
    setIdeas(ranked)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase.channel('shortlist')
    for (const table of ['ideas', 'votes', 'likes', 'ai_analysis', 'settings']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { ideas, settings, error, reload: load }
}

/** Sets this member's points for an idea (0 removes the vote). Returns an error message or null. */
export async function setVote(ideaId: string, memberId: string, points: number) {
  const { error } = points > 0
    ? await supabase.from('votes').upsert({ idea_id: ideaId, member_id: memberId, points }, { onConflict: 'idea_id,member_id' })
    : await supabase.from('votes').delete().eq('idea_id', ideaId).eq('member_id', memberId)
  return error ? error.message : null
}

/** This member's points per idea and how many they have left. */
export function useMyVotes(ideas: RankedIdea[] | null, budget: number, memberId: string | undefined) {
  const mine = (i: RankedIdea) => i.votes.find((v) => v.member_id === memberId)?.points ?? 0
  const used = (ideas ?? []).reduce((s, i) => s + mine(i), 0)
  return { mine, left: Math.max(0, budget - used), used }
}
