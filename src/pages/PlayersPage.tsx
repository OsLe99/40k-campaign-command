import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, PAGE_SIZE, rpc } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { Button } from '../components/ui/button'
import { Badge, Empty, ErrorBox, Feedback, Field, Loading, PageHeader, Pagination, RequireLogin } from '../components/ui/shared'
import { ArmyCards } from './ArmiesPage'
import { AuditList } from './ManageCampaignPage'
import { ThemeSettings } from '../components/ThemeSettings'

export function PlayersPage() {
  const [page, setPage] = useState(0)
  const q = useQuery({ queryKey: ['profiles'], queryFn: api.profiles })
  const visible = q.data?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) || []
  return <><PageHeader eyebrow="COMMANDER REGISTRY" title="Players" /><ErrorBox error={q.error} />
    {q.isPending ? <Loading /> : <section className="panel">{visible.map(p => <Link className="list-row" key={p.id} to={`/players/${p.id}`}><strong>{p.display_name}</strong><span className="muted">@{p.username}</span></Link>)}{!visible.length && <Empty>No commanders registered.</Empty>}</section>}
    <Pagination page={page} count={visible.length} onPage={setPage} /></>
}
export function PlayerPage() {
  const { id = '' } = useParams()
  const q = useQuery({ queryKey: ['profile', id], queryFn: () => api.profile(id) })
  const armies = useQuery({ queryKey: ['armies', id], queryFn: () => api.armies(id) })
  return <><ErrorBox error={q.error || armies.error} />{q.isPending ? <Loading /> : q.data && <>
    <PageHeader eyebrow={`@${q.data.username}`} title={q.data.display_name}>Commander since {new Date(q.data.created_at).toLocaleDateString()}</PageHeader>
    <h2>Mustered forces</h2>{armies.isPending ? <Loading /> : armies.data?.length ? <ArmyCards armies={armies.data} /> : <Empty>No armies recorded.</Empty>}
  </>}</>
}
export function AccountPage() {
  const { user } = useAuth()
  const action = useAction()
  const q = useQuery({ queryKey: ['profile', user?.id], queryFn: () => api.profile(user!.id), enabled: !!user })
  const battles = useQuery({ queryKey: ['my-battles', user?.id], queryFn: () => api.myBattles(user!.id), enabled: !!user })
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await action.run(() => api.saveProfile(user!.id, { username: String(f.get('username')), display_name: String(f.get('display_name')) }))
  }
  return <RequireLogin user={user}><PageHeader eyebrow="PERSONAL COMMAND" title="Your command desk" action={<Button asChild><Link to="/armies/new">Muster an army</Link></Button>} />
    <ErrorBox error={q.error || battles.error} /><div className="two-column">
      <section className="panel"><h2>Commander profile</h2><Feedback action={action} />{q.isPending ? <Loading /> : q.data && <form className="stack" onSubmit={save}>
        <Field label="Display name"><input name="display_name" required maxLength={80} defaultValue={q.data.display_name} /></Field>
        <Field label="Username" hint="3–40 lowercase letters, digits, or underscores."><input name="username" required minLength={3} maxLength={40} pattern="[a-z0-9_]+" defaultValue={q.data.username} /></Field>
        <Button type="submit" disabled={action.pending}>Update profile</Button>
      </form>}</section>
      <section className="panel"><h2>Your battle reports</h2><p className="muted">Open pending reports to confirm or dispute them.</p>{battles.isPending ? <Loading /> : battles.data?.length ? battles.data.map(b => <Link key={b.id} className="list-row" to={`/battles/${b.id}`}><strong>{b.mission}</strong><Badge>{b.status}</Badge></Link>) : <Empty>No battle submissions yet.</Empty>}</section>
    </div><ThemeSettings /></RequireLogin>
}
export function AdminPage() {
  const { user } = useAuth()
  const action = useAction()
  const admins = useQuery({ queryKey: ['admins', user?.id], queryFn: api.admins, enabled: !!user })
  const isAdmin = admins.data?.some(a => a.player_id === user?.id)
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: api.profiles, enabled: !!isAdmin })
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => api.audit(), enabled: !!isAdmin })
  return <RequireLogin user={user}><PageHeader eyebrow="HIGH COMMAND" title="Global administration">Campaign administrators do not automatically receive global access.</PageHeader><ErrorBox error={admins.error || profiles.error || audit.error} />
    {admins.isPending ? <Loading /> : !isAdmin ? <Empty>Global administrator access is required.</Empty> : <>
      <section className="panel"><h2>Administrator assignments</h2><Feedback action={action} />
        {profiles.data?.map(p => { const enabled = admins.data?.some(a => a.player_id === p.id); return <div className="list-row" key={p.id}><Link to={`/players/${p.id}`}>{p.display_name} <span className="muted">@{p.username}</span></Link>
          <Button disabled={action.pending} variant={enabled ? 'outline' : 'default'} onClick={() => {
            if (window.confirm(`${enabled ? 'Remove' : 'Grant'} global administrator privileges for ${p.display_name}?`)) void action.run(() => rpc('set_global_admin', { pid: p.id, enabled: !enabled }))
          }}>{enabled ? 'Remove global admin' : 'Grant global admin'}</Button></div> })}
      </section><AuditList entries={audit.data || []} />
    </>}
  </RequireLogin>
}
