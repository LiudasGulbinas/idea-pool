import { scoreColor } from '../lib/ai'
import type { AnalysisStatus } from '../lib/types'

export function ScoreBadge({ score, status }: { score: number | null | undefined; status?: AnalysisStatus }) {
  if (status === 'pending' || status === 'running') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"><span className="animate-pulse">🤖</span> analysing…</span>
  }
  if (score == null) return null
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreColor(score)}`} title="Claude's overall investor score (1–5)">🤖 {Number(score).toFixed(1)}</span>
}
