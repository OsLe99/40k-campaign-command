import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CalendarDays, Flag, Plus } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { date } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Badge, Empty, ErrorBox, Feedback, Field, Loading, PageHeader, Pagination, RequireLogin } from '../components/ui/shared'

export function CampaignsPage() {
  const { user } = useAuth()
  const [page, setPage] = useState(0)
  const query = useQuery({ queryKey: ['campaigns', page, user?.id], queryFn: () => api.campaigns(page) })
  return <>
    <section className="hero"><div className="hero-grid" aria-hidden="true" /><div className="hero-copy">
      <p className="eyebrow"><span className="live-dot" /> NARRATIVE CAMPAIGN COMMAND</p>
      <h1>Campaign command</h1>
      <p>Manage your Warhammer 40,000 campaigns, record battles, and track results.</p>
      <div className="actions"><Button asChild><Link to={user ? '/campaigns/new' : '/auth'}><Plus size={17} />{user ? 'Found a campaign' : 'Join the campaign'}</Link></Button><Button variant="ghost" onClick={() => document.getElementById('campaign-records')?.scrollIntoView({ behavior: 'smooth' })}>Explore the archives <ArrowUpRight size={16} /></Button></div>
    </div></section>
    <PageHeader eyebrow="THE STRATEGIC OVERVIEW" title="Campaign archives" action={user && <Button asChild variant="outline"><Link to="/campaigns/new"><Plus size={16} />New campaign</Link></Button>}>
      Independent war zones. Shared stories. Only confirmed results count.
    </PageHeader>
    <div id="campaign-records"><ErrorBox error={query.error} />{query.isPending ? <Loading /> : query.data?.length ?
      <div className="card-grid">{query.data.map((c, i) => <Link key={c.id} to={`/campaigns/${c.id}`} className="campaign-card">
        <div className={`campaign-art art-${i % 3}`} aria-hidden="true"><Flag size={58} strokeWidth={0.8} /><span>SECTOR / {c.id.slice(0, 6).toUpperCase()}</span></div>
        <div className="card-body"><div className="spread"><Badge>{c.status}</Badge>{!c.is_published && <Badge>Draft</Badge>}<ArrowUpRight size={18} /></div>
          <h2>{c.name}</h2><p className="clamp">{c.description || 'The next chapter is waiting to be written.'}</p>
          <div className="card-footer"><CalendarDays size={14} />{date(c.start_date)}</div>
        </div></Link>)}</div> : !query.error && <Empty><Flag size={32} /><h2>No campaigns in the archives</h2><p>Published campaigns will appear here. Found a campaign to begin your story.</p></Empty>}
      <Pagination page={page} count={query.data?.length || 0} onPage={setPage} />
    </div>
  </>
}
export function NewCampaignPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const action = useAction()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    await action.run(() => api.createCampaign(data), id => navigate(`/campaigns/${id}/manage`))
  }
  return <RequireLogin user={user}><div className="narrow"><PageHeader title="Found a campaign">New campaigns begin as unpublished drafts. You become their campaign administrator, not a global administrator.</PageHeader>
    <form className="panel stack" onSubmit={submit}><Feedback action={action} />
      <Field label="Campaign name"><input name="name" required maxLength={120} /></Field>
      <Field label="Description"><textarea name="description" rows={4} maxLength={10000} /></Field>
      <Field label="Background lore"><textarea name="lore" rows={6} maxLength={20000} /></Field>
      <div className="form-grid"><Field label="Start date"><input type="date" name="start_date" /></Field><Field label="End date"><input type="date" name="end_date" /></Field></div>
      <Button type="submit" disabled={action.pending}>Create draft campaign</Button>
    </form></div></RequireLogin>
}
