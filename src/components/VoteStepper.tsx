export function VoteStepper({
  points,
  left,
  disabled,
  onChange,
  dark,
}: {
  points: number
  left: number
  disabled?: boolean
  onChange: (points: number) => void
  dark?: boolean
}) {
  const btn = `flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition active:scale-90 disabled:opacity-30 ${
    dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
  }`
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
      <button className={btn} disabled={disabled || points <= 0} onClick={() => onChange(points - 1)} aria-label="Remove a point">−</button>
      <span className={`min-w-14 text-center text-sm font-semibold ${dark ? 'text-white' : ''}`}>
        <span className="text-xl">{points}</span> pt{points === 1 ? '' : 's'}
      </span>
      <button className={btn} disabled={disabled || left <= 0} onClick={() => onChange(points + 1)} aria-label="Add a point">+</button>
    </div>
  )
}
