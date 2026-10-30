import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { IDEA_SELECT, type Analysis, type Idea, type Like } from './types'

export interface FeedIdea extends Idea {
  likeCount: number
  likedByMe: boolean
  commentCount: number
  analysis: Pick<Analysis, 'status' | 'overall_score' | 'team_fit'> | null
}

/** All visible ideas with like/comment counts, kept up to date live as teammates post, like or comment. */
export function useIdeas(memberId: string | undefined) {
  const [ideas, setIdeas] = useState<FeedIdea[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [ideasRes, likesRes, commentsRes, analysisRes] = await Promise.all([
      supabase.from('ideas').select(IDEA_SELECT).order('created_at', { ascending: false }),
      supabase.from('likes').select('idea_id, member_id'),
      supabase.from('comments').select('idea_id'),
      supabase.from('ai_analysis').select('idea_id, status, overall_score, team_fit'),
    ])
    const err = ideasRes.error ?? likesRes.error ?? commentsRes.error
    if (err) return setError(err.message)
    const likes = likesRes.data as Like[]
    const comments = commentsRes.data as { idea_id: string }[]
    // Analyses are optional extras: the feed still works if they can't be loaded.
    const analyses = (analysisRes.data ?? []) as (FeedIdea['analysis'] & { idea_id: string })[]
    setError(null)
    setIdeas(
      (ideasRes.data as Idea[]).map((i) => ({
        ...i,
        likeCount: likes.filter((l) => l.idea_id === i.id).length,
        likedByMe: likes.some((l) => l.idea_id === i.id && l.member_id === memberId),
        commentCount: comments.filter((c) => c.idea_id === i.id).length,
        analysis: analyses.find((a) => a.idea_id === i.id) ?? null,
      })),
    )
  }, [memberId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('ideas-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_analysis' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { ideas, setIdeas, error, reload: load }
}
