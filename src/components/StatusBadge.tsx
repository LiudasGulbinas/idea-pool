import { STATUSES, type IdeaStatus } from '../lib/types'

export function StatusBadge({ status }: { status: IdeaStatus }) {
  const s = STATUSES.find((x) => x.value === status)!
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>
}
