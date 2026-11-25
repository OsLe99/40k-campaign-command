import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { db, authRedirect } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { Button } from '../components/ui/button'
import { Feedback, Field, PageHeader } from '../components/ui/shared'

export function AuthPage() {
  const { user } = useAuth()
  const action = useAction()
  const [mode, setMode] = useState<'login' | 'register' | 'resend'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
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
        {(['login', 'register', 'resend'] as const).map(m => <Button key={m} variant={m === mode ? 'default' : 'ghost'} onClick={() => { setMode(m); setSent(false) }}>
          {m === 'login' ? 'Sign in' : m === 'register' ? 'Register' : 'Resend email'}</Button>)}
      </div><Feedback action={action} />
        {sent && <p className="notice" role="status">Check your email for a verification link. Open it in this browser and device, then sign in.</p>}
        <form onSubmit={submit} className="stack">
          <Field label="Email"><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
          {mode !== 'resend' && <Field label="Password" hint="At least 12 characters for a new account."><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 12 : 1} value={password} onChange={e => setPassword(e.target.value)} /></Field>}
          <Button type="submit" disabled={action.pending}>{action.pending ? 'Working…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send verification email'}</Button>
        </form>
      </section>}
  </div>
}
