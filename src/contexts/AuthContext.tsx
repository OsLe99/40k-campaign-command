import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { message } from '../lib/utils'

type AuthState = { session: Session | null; loading: boolean; error: string }
const Context = createContext<AuthState>({ session: null, loading: true, error: '' })
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: '' })
  useEffect(() => {
    if (!supabase) return
    let live = true
    let initialized = false
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!live) return
      if (initialized) client.clear()
      initialized = true
      setState({ session, loading: false, error: '' })
    })
    const callbackError = new URLSearchParams(window.location.search).get('error_description')
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) setState({ session: data.session, loading: false, error: error ? message(error) : callbackError || '' })
    }).catch(error => { if (live) setState({ session: null, loading: false, error: message(error) }) })
    return () => { live = false; data.subscription.unsubscribe() }
  }, [client])
  return <Context.Provider value={state}>{children}</Context.Provider>
}
export function useAuth() {
  const state = useContext(Context)
  return { ...state, user: state.session?.user ?? null }
}
