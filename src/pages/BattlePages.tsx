import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, rpc } from '../services/api'
import { date } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { BattleForm } from '../components/BattleForm'
import { Gallery } from '../components/Gallery'
import { Button } from '../components/ui/button'
import { Badge, Empty, ErrorBox, Feedback, Field, Loading, PageHeader, RequireLogin } from '../components/ui/shared'

export function NewBattlePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  return <RequireLogin user={user}><div className="narrow"><PageHeader title="Record a battle" /><BattleForm campaignId={id} onSave={async data => {
    const bid = await api.submitBattle(id, data)
    navigate(`/battles/${bid}`)
  }} /></div></RequireLogin>
}
export function BattlePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const action = useAction()
  const [editing, setEditing] = useState(false)
  const battle = useQuery({ queryKey: ['battle', id], queryFn: () => api.battle(id) })
  const people = useQuery({ queryKey: ['participants', id], queryFn: () => api.participants(id) })
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: api.profiles })
  const armies = useQuery({ queryKey: ['armies'], queryFn: () => api.armies() })
  const responses = useQuery({ queryKey: ['responses', id], queryFn: () => api.responses(id), enabled: !!user })
  const cid = battle.data?.campaign_id || ''
  const members = useQuery({ queryKey: ['members', cid], queryFn: () => api.members(cid), enabled: !!cid })
  const admins = useQuery({ queryKey: ['admins', user?.id], queryFn: api.admins, enabled: !!user })
  if (battle.isPending) return <Loading />
  if (!battle.data) return <ErrorBox error={battle.error || new Error('Battle not found or not visible.')} />
  const b = battle.data
  const active = members.data?.some(m => m.player_id === user?.id && m.is_active)
  const admin = members.data?.some(m => m.player_id === user?.id && m.role === 'CampaignAdmin' && m.is_active) || admins.data?.some(a => a.player_id === user?.id) || false
  const participant = people.data?.find(p => p.player_id === user?.id)
  const correctable = admin || (b.submitted_by === user?.id && active && ['Pending', 'Disputed'].includes(b.status))
  async function respond(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await action.run(() => rpc('respond_battle', { bid: id, expected_revision: b.revision, answer: String(f.get('answer')), explanation: String(f.get('reason')) }))
  }
  async function resolve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await action.run(() => rpc('resolve_battle', { bid: id, expected_revision: b.revision, decision: String(f.get('decision')), explanation: String(f.get('reason')) }))
  }
  return <><Link className="back-link" to={`/campaigns/${cid}`}>← Campaign briefing</Link><PageHeader eyebrow="AFTER-ACTION REPORT" title={b.mission} action={correctable && <Button variant="outline" onClick={() => setEditing(!editing)}>{editing ? 'Cancel correction' : 'Correct report'}</Button>}>
    <div className="actions"><Badge>{b.status}</Badge><span>{date(b.battle_date)} · {b.points_limit || 'Unspecified'} points · Revision {b.revision}</span></div></PageHeader>
    <Feedback action={action} /><ErrorBox error={people.error || profiles.error || armies.error || responses.error || members.error || admins.error} />
    {editing && people.data ? <BattleForm key={`${id}-${b.revision}`} campaignId={cid} initial={{ mission: b.mission, description: b.description, battle_date: b.battle_date, points_limit: b.points_limit, participants: people.data.map(p => ({ player_id: p.player_id, army_id: p.army_id, result: p.result, victory_points: p.victory_points })) }}
      onSave={async data => { await api.reviseBattle(id, b.revision, data); setEditing(false) }} /> : <>
      <section className="panel"><h2>Engaged forces</h2>{people.isPending ? <Loading /> : people.data?.map(p => <div key={p.id} className="list-row wrap">
        <div><Link to={`/players/${p.player_id}`}><strong>{profiles.data?.find(pr => pr.id === p.player_id)?.display_name || 'Commander'}</strong></Link><p><Link to={`/armies/${p.army_id}`}>{armies.data?.find(a => a.id === p.army_id)?.name || 'Army'}</Link></p></div>
        <div className="actions"><Badge>{p.result}</Badge><span>{p.victory_points ?? '—'} VP</span><Badge>{p.is_confirmed ? 'Attested' : 'Awaiting'}</Badge></div>
      </div>)}</section>
      <section className="panel"><h2>From the battlefield</h2><p className="prose">{b.description || 'No written report submitted.'}</p></section>
    </>}
    {participant && active && ['Pending', 'Disputed'].includes(b.status) && <form className="panel stack" onSubmit={respond}><h2>Verify this report</h2><p className="muted">Confirm the current revision or explain what needs correcting. Disputes require administrative resolution or a corrected report.</p>
      <Field label="Your response"><select name="answer"><option>Confirmed</option><option>Disputed</option></select></Field><Field label="Reason (required for disputes)"><textarea name="reason" maxLength={2000} rows={3} /></Field><Button type="submit" disabled={action.pending}>Submit response</Button>
    </form>}
    {admin && <form className="panel stack" onSubmit={resolve}><h2>Administrative resolution</h2><Field label="Decision"><select name="decision"><option>Confirmed</option><option>Rejected</option></select></Field><Field label="Resolution reason"><textarea name="reason" required maxLength={2000} rows={3} /></Field><Button type="submit" disabled={action.pending}>Record resolution</Button></form>}
    {user && <section className="panel"><h2>Confirmation history</h2>{responses.data?.length ? responses.data.map(r => <div className="list-row wrap" key={`${r.player_id}-${r.revision}`}><div><strong>{profiles.data?.find(p => p.id === r.player_id)?.display_name || 'Commander'}</strong><p>{r.reason}</p><small>Revision {r.revision} · {new Date(r.responded_at).toLocaleString()}</small></div><Badge>{r.response}</Badge></div>) : <Empty>No visible responses.</Empty>}</section>}
    <Gallery kind="battle" id={id} canUpload={admin || !!(active && participant && b.status !== 'Rejected')} canModerate={admin} />
  </>
}
