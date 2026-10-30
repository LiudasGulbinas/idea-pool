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
