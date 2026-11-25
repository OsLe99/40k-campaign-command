import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { api } from '../services/api'
import { applyTheme, DEFAULT_THEME, getTheme, isThemeId, type Theme, type ThemeId } from '../lib/themes'
import { message } from '../lib/utils'

type ThemeState = {
  theme: Theme; loading: boolean; pending: boolean; canSave: boolean
  error: string; notice: string; selectTheme: (id: ThemeId) => Promise<void>; retry: () => void
}
const Context = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const userId = !loading ? user?.id : undefined
  // A new identity gets a fresh session, not the previous user's optimistic state.
  return <ThemeSession key={userId || 'visitor'} userId={userId}>{children}</ThemeSession>
}

function ThemeSession({ userId, children }: { userId?: string; children: ReactNode }) {
  const cache = useQueryClient()
  const [preview, setPreview] = useState<ThemeId | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const live = useRef(false)
  const saving = useRef(false)
  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => api.profile(userId!),
    enabled: !!userId,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    refetchInterval: 60000,
  })
  const ownProfile = userId && profile.data?.id === userId ? profile.data : undefined
  const theme = getTheme(userId ? preview || ownProfile?.theme : DEFAULT_THEME)

  useLayoutEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])
  useLayoutEffect(() => {
    applyTheme(theme)
    return () => applyTheme(getTheme(DEFAULT_THEME))
  }, [theme])

  async function selectTheme(id: ThemeId) {
    if (!userId || !ownProfile || !isThemeId(id) || saving.current) return
    saving.current = true
    setPending(true); setError(''); setNotice(''); setPreview(id)
    try {
      await cache.cancelQueries({ queryKey: ['profile', userId], exact: true })
      if (!live.current) return
      const saved = await api.saveTheme(userId, id)
      if (!live.current) return
      if (saved.id !== userId || !isThemeId(saved.theme)) throw new Error('Invalid theme preference response. Please retry.')
      cache.setQueryData(['profile', userId], saved)
      setNotice('Personal theme saved. It will follow your account on other devices.')
    } catch (cause) {
      if (live.current) setError(message(cause))
    } finally {
      saving.current = false
      if (live.current) { setPreview(null); setPending(false) }
    }
  }
  return <Context.Provider value={{
    theme, loading: !!userId && profile.isPending, pending, canSave: !!ownProfile,
    error: error || (profile.error ? message(profile.error) : ''), notice, selectTheme,
    retry: () => { void profile.refetch() },
  }}>{children}</Context.Provider>
}

export function useTheme() {
  const context = useContext(Context)
  if (!context) throw new Error('ThemeProvider is required.')
  return context
}
