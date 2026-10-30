import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { IDEA_SELECT, type Idea } from './types'

/** All visible ideas, kept up to date live as teammates post or edit. */
export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ideas').select(IDEA_SELECT).order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setIdeas(data as Idea[])
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('ideas-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { ideas, error, reload: load }
}
