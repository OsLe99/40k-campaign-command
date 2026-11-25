import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db, authRedirect } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { Button } from '../components/ui/button'
import { ErrorBox, Feedback, Field, PageHeader } from '../components/ui/shared'
import { message } from '../lib/utils'

export function AuthPage() {
  const { user } = useAuth()
  const action = useAction()
  const [mode, setMode] = useState<'login' | 'register' | 'resend'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [oauthPending, setOauthPending] = useState(false)
  const [oauthError, setOauthError] = useState('')
  const busy = action.pending || oauthPending
  async function signInWithDiscord() {
    if (busy) return
    setOauthError('')
    setSent(false)
    setOauthPending(true)
    try {
      const { error } = await db().auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: authRedirect() },
      })
      if (error) throw error
    } catch (error) {
      setOauthError(message(error))
      setOauthPending(false)
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setOauthError('')
    await action.run(async () => {
      const auth = db().auth
      const result = mode === 'login' ? await auth.signInWithPassword({ email, password })
        : mode === 'register' ? await auth.signUp({ email, password, options: { emailRedirectTo: authRedirect() } })
        : await auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirect() } })
      if (result.error) throw result.error
      if (mode !== 'login') setSent(true)
    })
  }
  return <div className="narrow"><PageHeader eyebrow="COMMANDER ACCESS" title={user ? 'You are signed in' : 'Return to command'} />
    {user ? <section className="panel"><p>{user.email}</p><Button asChild><Link to="/account">Open your command desk</Link></Button></section> :
      <section className="panel"><div className="tabs" role="group" aria-label="Authentication options">
        {(['login', 'register', 'resend'] as const).map(m => <Button key={m} disabled={busy} variant={m === mode ? 'default' : 'ghost'} onClick={() => { setMode(m); setSent(false); setOauthError('') }}>
          {m === 'login' ? 'Sign in' : m === 'register' ? 'Register' : 'Resend email'}</Button>)}
      </div>
        {mode !== 'resend' && <div className="oauth-options">
          <Button type="button" variant="outline" onClick={signInWithDiscord} disabled={busy}>{oauthPending ? 'Connecting to Discord…' : 'Continue with Discord'}</Button>
          {oauthPending && <p className="muted" role="status">Redirecting to Discord…</p>}
          <p className="muted">Or continue with email and password.</p>
        </div>}
        <ErrorBox error={oauthError} /><Feedback action={action} />
        {sent && <p className="notice" role="status">Check your email for a verification link. Open it in this browser and device, then sign in.</p>}
        <form onSubmit={submit} className="stack">
          <Field label="Email"><input type="email" autoComplete="email" required disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></Field>
          {mode !== 'resend' && <Field label="Password" hint="At least 12 characters for a new account."><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required disabled={busy} minLength={mode === 'register' ? 12 : 1} value={password} onChange={e => setPassword(e.target.value)} /></Field>}
          <Button type="submit" disabled={busy}>{action.pending ? 'Working…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send verification email'}</Button>
        </form>
      </section>}
  </div>
}
