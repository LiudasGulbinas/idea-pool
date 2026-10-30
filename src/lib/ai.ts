import { supabase } from './supabase'

/** Starts Claude's analysis of an idea in the background; results arrive live via the ai_analysis table. */
export async function startAnalysis(ideaId: string, opts: { force?: boolean; mode?: 'full' | 'team_fit' } = {}) {
  const { data, error } = await supabase.functions.invoke('analyze-idea', { body: { idea_id: ideaId, ...opts } })
  if (error) return functionError(error)
  return data?.error ? (data.error as string) : null
}

export async function startProfileSummary() {
  const { data, error } = await supabase.functions.invoke('summarize-profile', { body: {} })
  if (error) return functionError(error)
  return data?.error ? (data.error as string) : null
}

async function functionError(error: { message: string; context?: unknown }) {
  // Edge Function errors carry the server's JSON message in the response body.
  const res = error.context as Response | undefined
  try {
    const body = await res?.json()
    if (body?.error) return body.error as string
  } catch {
    /* not JSON */
  }
  return error.message
}

export function scoreColor(score: number | null | undefined) {
  if (score == null) return 'bg-slate-100 text-slate-500'
  if (score >= 4) return 'bg-green-100 text-green-800'
  if (score >= 3) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-700'
}
