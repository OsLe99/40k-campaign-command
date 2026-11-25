import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, rpc } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { Button } from '../components/ui/button'
import { Badge, ErrorBox, Feedback, Field, Loading, PageHeader, RequireLogin } from '../components/ui/shared'
import type { Audit } from '../types/domain'

export function AuditList({ entries }: { entries: Audit[] }) {
  return <section className="panel"><h2>Moderation log</h2><p className="muted">Most recent 100 actions.</p>{entries.length ? entries.map(e => <div className="audit-row" key={e.id}><strong>{e.action}</strong><p>{e.reason}</p><small>{new Date(e.created_at).toLocaleString()} · <Link to={`/players/${e.actor_id}`}>Actor</Link></small></div>) : <p className="muted">No moderation actions recorded.</p>}</section>
}
export function ManageCampaignPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const action = useAction()
  const campaign = useQuery({ queryKey: ['campaign', id], queryFn: () => api.campaign(id), enabled: !!user })
  const members = useQuery({ queryKey: ['members', id], queryFn: () => api.members(id), enabled: !!user })
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: api.profiles, enabled: !!user })
  const admins = useQuery({ queryKey: ['admins', user?.id], queryFn: api.admins, enabled: !!user })
  const audit = useQuery({ queryKey: ['audit', id], queryFn: () => api.audit(id), enabled: !!user })
  const isAdmin = members.data?.some(m => m.player_id === user?.id && m.role === 'CampaignAdmin' && m.is_active) || admins.data?.some(a => a.player_id === user?.id)
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await action.run(() => api.saveCampaign(id, { ...Object.fromEntries(form), is_published: form.has('is_published') }))
  }
  return <RequireLogin user={user}>{campaign.isPending ? <Loading /> : <>
    <PageHeader title="Campaign command" action={<Button asChild variant="outline"><Link to={`/campaigns/${id}`}>Return to campaign</Link></Button>} />
    <ErrorBox error={campaign.error || members.error || profiles.error || admins.error || audit.error} />
    {!isAdmin ? <p className="alert">Campaign administrator access is required.</p> : campaign.data && <>
      <form className="panel stack" onSubmit={save} key={campaign.data.updated_at}><Feedback action={action} /><h2>Campaign settings</h2>
        <Field label="Name"><input name="name" required maxLength={120} defaultValue={campaign.data.name} /></Field>
        <Field label="Description"><textarea name="description" rows={4} maxLength={10000} defaultValue={campaign.data.description} /></Field>
        <Field label="Background lore"><textarea name="lore" rows={6} maxLength={20000} defaultValue={campaign.data.lore} /></Field>
        <div className="form-grid"><Field label="Start date"><input name="start_date" type="date" defaultValue={campaign.data.start_date || ''} /></Field><Field label="End date"><input name="end_date" type="date" defaultValue={campaign.data.end_date || ''} /></Field>
          <Field label="Status"><select name="status" defaultValue={campaign.data.status}>{['Upcoming', 'Active', 'Completed'].map(s => <option key={s}>{s}</option>)}</select></Field></div>
        <label className="checkbox"><input name="is_published" type="checkbox" defaultChecked={campaign.data.is_published} />Publish campaign and confirmed reports for public browsing</label>
        <Button type="submit" disabled={action.pending}>Save campaign</Button>
      </form>
      <section className="panel"><h2>Campaign membership</h2><p className="muted">Inactive members retain their battle history. Keep at least one active campaign administrator.</p>
        {members.data?.map(m => <div className="list-row wrap" key={m.id}><div><Link to={`/players/${m.player_id}`}>{profiles.data?.find(p => p.id === m.player_id)?.display_name || m.player_id}</Link><div><Badge>{m.role}</Badge> <Badge>{m.is_active ? 'Active' : 'Inactive'}</Badge></div></div>
          <div className="actions"><Button variant="outline" disabled={action.pending} onClick={() => action.run(() => rpc('manage_member', { cid: id, pid: m.player_id, new_role: m.role === 'Member' ? 'CampaignAdmin' : 'Member', active: m.is_active }))}>{m.role === 'Member' ? 'Make admin' : 'Make member'}</Button><Button variant="outline" disabled={action.pending} onClick={() => action.run(() => rpc('manage_member', { cid: id, pid: m.player_id, new_role: m.role, active: !m.is_active }))}>{m.is_active ? 'Deactivate' : 'Reactivate'}</Button></div>
        </div>)}
      </section><AuditList entries={audit.data || []} />
    </>}
  </>}</RequireLogin>
}
