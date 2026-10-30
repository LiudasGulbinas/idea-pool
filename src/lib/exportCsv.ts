import { supabase } from './supabase'
import { IDEA_SELECT, memberName, type Analysis, type Idea, type Vote } from './types'

function cell(v: unknown) {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Downloads every idea with its AI analysis, likes, comments and votes as a CSV file (opens in Excel / Google Sheets). */
export async function exportIdeasCsv() {
  const [ideasRes, likesRes, commentsRes, votesRes, analysisRes] = await Promise.all([
    supabase.from('ideas').select(IDEA_SELECT).order('created_at'),
    supabase.from('likes').select('idea_id'),
    supabase.from('comments').select('idea_id'),
    supabase.from('votes').select('idea_id, points'),
    supabase.from('ai_analysis').select('*'),
  ])
  const err = ideasRes.error ?? likesRes.error ?? commentsRes.error ?? votesRes.error ?? analysisRes.error
  if (err) throw new Error(err.message)

  const ideas = ideasRes.data as Idea[]
  const analyses = analysisRes.data as Analysis[]
  const votes = votesRes.data as Pick<Vote, 'idea_id' | 'points'>[]
  const criteria = [...new Map(analyses.flatMap((a) => a.criteria ?? []).map((c) => [c.key, c.name])).entries()]
  const count = (rows: { idea_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.idea_id === id).length

  const header = [
    'Title', 'Pitch', 'Problem', 'Solution', 'Target customer', 'How it makes money', 'Tags', 'Status', 'Hidden', 'Author', 'Created',
    'Likes', 'Comments', 'Vote points', 'AI overall score', ...criteria.map(([, name]) => `AI: ${name}`),
    'AI verdict', 'AI recommendations', 'Investor questions', 'Similar companies', 'Best team fit', 'Team gaps', 'Link',
  ]
  const rows = ideas.map((i) => {
    const a = analyses.find((x) => x.idea_id === i.id)
    return [
      i.title, i.pitch, i.problem, i.solution, i.target_customer, i.revenue_model, i.tags.join(', '), i.status, i.hidden ? 'yes' : '',
      i.author ? memberName(i.author) : '', i.created_at.slice(0, 10),
      count(likesRes.data, i.id), count(commentsRes.data, i.id), votes.filter((v) => v.idea_id === i.id).reduce((s, v) => s + v.points, 0),
      a?.overall_score ?? '', ...criteria.map(([key]) => a?.criteria?.find((c) => c.key === key)?.score ?? ''),
      a?.verdict ?? '', (a?.recommendations ?? []).join(' | '), (a?.investor_questions ?? []).join(' | '),
      (a?.similar_companies ?? []).map((c) => `${c.name} (${c.url})`).join(' | '),
      (a?.team_fit?.members ?? []).map((m) => `${m.name}: ${m.role}`).join(' | '), (a?.team_fit?.gaps ?? []).join(' | '),
      `${window.location.origin}/ideas/${i.id}`,
    ]
  })

  // BOM so Excel reads Lithuanian characters (ą, č, ė, š, ž…) correctly.
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `idea-pool-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  return ideas.length
}
