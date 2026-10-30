export type Role = 'member' | 'admin'

export interface Member {
  id: string
  user_id: string | null
  email: string
  display_name: string | null
  avatar_color: string
  role: Role
  created_at: string
}

export function memberName(m: Pick<Member, 'display_name' | 'email'>) {
  return m.display_name?.trim() || m.email.split('@')[0]
}

export type IdeaStatus = 'new' | 'shortlisted' | 'parked' | 'chosen'

export const STATUSES: { value: IdeaStatus; label: string; className: string }[] = [
  { value: 'new', label: 'New', className: 'bg-sky-100 text-sky-800' },
  { value: 'shortlisted', label: 'Shortlisted', className: 'bg-amber-100 text-amber-800' },
  { value: 'parked', label: 'Parked', className: 'bg-slate-200 text-slate-700' },
  { value: 'chosen', label: 'Chosen 🏆', className: 'bg-green-100 text-green-800' },
]

export interface Idea {
  id: string
  author_id: string
  title: string
  pitch: string
  problem: string
  solution: string
  target_customer: string
  revenue_model: string
  tags: string[]
  status: IdeaStatus
  hidden: boolean
  created_at: string
  updated_at: string
  author?: Pick<Member, 'id' | 'display_name' | 'email' | 'avatar_color'>
}

export const IDEA_SELECT = '*, author:members!ideas_author_id_fkey(id, display_name, email, avatar_color)'

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

export interface Like {
  idea_id: string
  member_id: string
}

export interface Comment {
  id: string
  idea_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  author?: Pick<Member, 'id' | 'display_name' | 'email' | 'avatar_color'>
}

export const COMMENT_SELECT = '*, author:members!comments_author_id_fkey(id, display_name, email, avatar_color)'
