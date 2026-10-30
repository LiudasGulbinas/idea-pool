import { memberName, type Member } from '../lib/types'

export function Avatar({ member, size = 36 }: { member: Pick<Member, 'display_name' | 'email' | 'avatar_color'>; size?: number }) {
  const name = memberName(member)
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ background: member.avatar_color, width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initials}
    </span>
  )
}
