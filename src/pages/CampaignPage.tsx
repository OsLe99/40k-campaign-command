import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings, Swords, Trophy, Users } from 'lucide-react'
import { api, rpc } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { date, rankStandings } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Badge, Empty, ErrorBox, Feedback, Loading, PageHeader, Pagination } from '../components/ui/shared'

export function CampaignPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const action = useAction()
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState('overview')
  const campaign = useQuery({ queryKey: ['campaign', id], queryFn: () => api.campaign(id) })
  const members = useQuery({ queryKey: ['members', id], queryFn: () => api.members(id) })
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: api.profiles })
  const standings = useQuery({ queryKey: ['standings', id], queryFn: () => api.standings(id) })
  const count = useQuery({ queryKey: ['confirmed-count', id], queryFn: () => api.confirmedCount(id) })
  const battles = useQuery({ queryKey: ['battles', id, page], queryFn: () => api.battles(id, page) })
  const armies = useQuery({ queryKey: ['armies'], queryFn: () => api.armies() })
  const registrations = useQuery({ queryKey: ['registrations', id], queryFn: () => api.registrations(id) })
  const admins = useQuery({ queryKey: ['admins', user?.id], queryFn: api.admins, enabled: !!user })
  if (campaign.isPending) return <Loading />
  if (!campaign.data) return <ErrorBox error={campaign.error || new Error('Campaign not found or not visible.')} />
  const c = campaign.data
  const membership = members.data?.find(m => m.player_id === user?.id)
  const isAdmin = (membership?.role === 'CampaignAdmin' && membership.is_active) || admins.data?.some(a => a.player_id === user?.id)
  const registeredIds = new Set(registrations.data?.map(r => r.army_id))
  const registered = armies.data?.filter(a => registeredIds.has(a.id)) || []
  const myArmies = armies.data?.filter(a => a.owner_id === user?.id && !registeredIds.has(a.id)) || []
  return <>
    <Link className="back-link" to="/">← Campaign archives</Link>
    <PageHeader title={c.name} action={<div className="actions">
      {user && !membership && c.is_published && c.status !== 'Completed' && <Button disabled={action.pending} onClick={() => action.run(() => rpc('join_campaign', { cid: id }))}>Join campaign</Button>}
      {membership?.is_active && c.status === 'Active' && <Button asChild><Link to={`/campaigns/${id}/battle/new`}><Plus size={16} />Record battle</Link></Button>}
      {isAdmin && <Button asChild variant="outline"><Link to={`/campaigns/${id}/manage`}><Settings size={16} />Manage</Link></Button>}
    </div>}><div className="actions"><Badge>{c.status}</Badge><Badge>{c.is_published ? 'Published' : 'Draft'}</Badge><span>{date(c.start_date)} — {date(c.end_date)}</span></div></PageHeader>
    <Feedback action={action} />
    {membership && !membership.is_active && <p className="alert">Your membership is inactive. Contact a campaign administrator to rejoin.</p>}
    <div className="stats-grid">
      <div className="stat"><Users /><strong>{members.data?.filter(m => m.is_active).length ?? '—'}</strong><span>Active commanders</span></div>
      <div className="stat"><Swords /><strong>{registered.length}</strong><span>Registered armies</span></div>
      <div className="stat"><Trophy /><strong>{count.data ?? '—'}</strong><span>Confirmed battles</span></div>
    </div>
    <nav className="tabs" aria-label="Campaign sections">{['overview', 'standings', 'battles', 'forces'].map(t =>
      <Button key={t} variant={tab === t ? 'default' : 'ghost'} onClick={() => setTab(t)}>{t}</Button>)}</nav>
    <ErrorBox error={members.error || profiles.error || standings.error || count.error || battles.error || armies.error || registrations.error || admins.error} />
    {tab === 'overview' && <div className="two-column"><section className="panel"><p className="eyebrow">THE WAR ZONE</p><h2>Campaign briefing</h2><p className="prose">{c.description || 'No briefing has been posted.'}</p><h3>Background lore</h3><p className="prose">{c.lore || 'The story is yet to unfold.'}</p></section>
      <section className="panel"><p className="eyebrow">CHAIN OF COMMAND</p><h2>Commanders</h2>{members.data?.filter(m => m.is_active).map(m => <div className="list-row" key={m.id}><Link to={`/players/${m.player_id}`}>{profiles.data?.find(p => p.id === m.player_id)?.display_name || 'Commander'}</Link><Badge>{m.role}</Badge></div>)}</section></div>}
    {tab === 'standings' && <section className="panel"><h2>Campaign standings</h2><p className="muted">Win 3 · Draw 1 · Loss 0. Confirmed battles only. Equal points and wins share a rank.</p>{standings.isPending ? <Loading /> : standings.data?.length ? <div className="table-scroll"><table><thead><tr>{['Rank', 'Commander', 'Played', 'W', 'D', 'L', 'Points'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rankStandings(standings.data).map(r => <tr key={r.player_id}><td className="rank">{String(r.rank).padStart(2, '0')}</td><td><Link to={`/players/${r.player_id}`}>{r.display_name}</Link><small>@{r.username}</small></td><td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td><td className="points">{r.points}</td></tr>)}</tbody></table></div> : <Empty>No commanders have joined yet.</Empty>}</section>}
    {tab === 'battles' && <section className="panel"><h2>Battle archive</h2>{battles.isPending ? <Loading /> : battles.data?.length ? battles.data.map(b => <Link className="list-row linked-row" to={`/battles/${b.id}`} key={b.id}><div><h3>{b.mission}</h3><span className="muted">{date(b.battle_date)} · {b.points_limit || 'Unspecified'} points</span></div><Badge>{b.status}</Badge></Link>) : <Empty>No visible battles recorded yet.</Empty>}<Pagination page={page} count={battles.data?.length || 0} onPage={setPage} /></section>}
    {tab === 'forces' && <section className="panel"><h2>Campaign forces</h2>{registered.length ? registered.map(a => <Link className="list-row" key={a.id} to={`/armies/${a.id}`}><strong>{a.name}</strong><span className="muted">{a.faction}</span></Link>) : <Empty>No armies registered.</Empty>}
      {membership?.is_active && <><h3>Register your army</h3>{myArmies.length ? myArmies.map(a => <div className="list-row" key={a.id}>{a.name}<Button disabled={action.pending} variant="outline" onClick={() => action.run(() => rpc('register_army', { cid: id, aid: a.id }))}>Register</Button></div>) : <p className="muted">All your armies are registered, or you need to <Link to="/armies/new">create an army</Link>.</p>}</>}
    </section>}
  </>
}
