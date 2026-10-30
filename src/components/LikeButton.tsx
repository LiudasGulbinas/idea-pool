export function LikeButton({ liked, count, onClick, small }: { liked: boolean; count: number; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition active:scale-90 ${
        small ? 'px-2.5 py-1 text-sm' : 'px-4 py-2'
      } ${liked ? 'border-pink-200 bg-pink-50 text-pink-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      <span>{liked ? '❤️' : '🤍'}</span>
      {count}
      {!small && <span className="font-normal">{count === 1 ? 'like' : 'likes'}</span>}
    </button>
  )
}
