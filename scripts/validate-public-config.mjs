import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), 'VITE_')
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
let privileged = key.startsWith('sb_secret_')
if (key.split('.').length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
    privileged ||= payload.role !== 'anon'
  } catch {
    privileged = true
  }
}
if (privileged) throw new Error('Frontend configuration must use a Supabase publishable or legacy anon key, never a privileged credential.')
