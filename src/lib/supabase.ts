import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { publicConfigError } from './config'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const configurationError = publicConfigError(url, key)
export const configured = !configurationError
export const supabase = configured ? createClient<Database>(url!, key!, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
}) : null
export function db() {
  if (!supabase) throw new Error('Supabase is not configured. Follow the setup instructions.')
  return supabase
}
export function authRedirect() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}
