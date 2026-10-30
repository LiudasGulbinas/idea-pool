import { createAvatar, type Style } from '@dicebear/core'
import * as adventurer from '@dicebear/adventurer'
import * as bigSmile from '@dicebear/big-smile'
import * as funEmoji from '@dicebear/fun-emoji'
import * as thumbs from '@dicebear/thumbs'
import { useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar } from './Avatar'

const STYLES: { name: string; style: Style<object> }[] = [
  { name: 'Fun emoji', style: funEmoji as Style<object> },
  { name: 'Big smile', style: bigSmile as Style<object> },
  { name: 'Adventurer', style: adventurer as Style<object> },
  { name: 'Thumbs', style: thumbs as Style<object> },
]
const BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c7f9cc']
const SIZE = 256

const randomSeeds = () => Array.from({ length: 5 }, () => Math.random().toString(36).slice(2, 10))

/** Draws an image source onto a square canvas (centre-cropped) and returns it as a compressed blob. */
async function toSquareBlob(src: string, type: 'image/png' | 'image/jpeg') {
  const img = new Image()
  img.src = src
  await img.decode()
  const side = Math.min(img.naturalWidth || SIZE, img.naturalHeight || SIZE)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  canvas.getContext('2d')!.drawImage(img, ((img.naturalWidth || SIZE) - side) / 2, ((img.naturalHeight || SIZE) - side) / 2, side, side, 0, 0, SIZE, SIZE)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image'))), type, 0.85))
}

export function AvatarPicker() {
  const { member, refreshMember } = useAuth()
  const [seeds, setSeeds] = useState(randomSeeds)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(
    () =>
      STYLES.map((s) => ({
        ...s,
        avatars: seeds.map((seed) => createAvatar(s.style, { seed, size: SIZE, backgroundColor: BACKGROUNDS, radius: 50 }).toDataUri()),
      })),
    [seeds],
  )

  if (!member) return null

  async function save(blob: Blob | null, ext: 'png' | 'jpg') {
    setBusy(true)
    setError(null)
    let url: string | null = null
    if (blob) {
      // A new file name each time, so phones and browsers don't keep showing the old cached picture.
      const path = `${member!.id}/avatar-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' })
      if (error) {
        setBusy(false)
        return setError(`Upload failed: ${error.message}`)
      }
      url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.from('members').update({ avatar_url: url }).eq('id', member!.id)
    if (error) setError(error.message)
    await refreshMember()
    setBusy(false)
  }

  async function pick(dataUri: string) {
    save(await toSquareBlob(dataUri, 'image/png'), 'png')
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please choose a photo (JPG or PNG).')
    const url = URL.createObjectURL(file)
    try {
      await save(await toSquareBlob(url, 'image/jpeg'), 'jpg')
    } catch {
      setError('Could not read that photo. Try a JPG or PNG.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar member={member} size={72} />
        <label className={`btn-primary cursor-pointer text-sm ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          📷 Upload my photo
          <input type="file" accept="image/*" className="hidden" onChange={upload} />
        </label>
        <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => setSeeds(randomSeeds())}>🎲 Shuffle</button>
        {member.avatar_url && <button type="button" className="text-sm text-slate-500 underline" disabled={busy} onClick={() => save(null, 'png')}>Use initials</button>}
      </div>

      {options.map((s) => (
        <div key={s.name}>
          <div className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{s.name}</div>
          <div className="flex flex-wrap gap-2">
            {s.avatars.map((uri) => (
              <button type="button" key={uri} disabled={busy} onClick={() => pick(uri)} className="rounded-full transition hover:scale-110 active:scale-95 disabled:opacity-50">
                <img src={uri} alt="" width={48} height={48} className="h-12 w-12 rounded-full" />
              </button>
            ))}
          </div>
        </div>
      ))}
      {busy && <p className="text-sm text-brand-700">Saving…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-[11px] text-slate-400">
        Avatars via DiceBear: “Fun Emoji” by Davis Uche, “Big Smile” by Ashley Seo, “Adventurer” by Lisa Wischofsky (CC BY 4.0), “Thumbs” by DiceBear.
      </p>
    </div>
  )
}
