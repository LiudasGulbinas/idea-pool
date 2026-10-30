import { supabase } from './supabase'

export async function toggleLike(ideaId: string, memberId: string, liked: boolean) {
  const { error } = liked
    ? await supabase.from('likes').delete().eq('idea_id', ideaId).eq('member_id', memberId)
    : await supabase.from('likes').insert({ idea_id: ideaId })
  return error
}
