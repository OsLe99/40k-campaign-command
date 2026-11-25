import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Swords } from 'lucide-react'
import { api, PAGE_SIZE } from '../services/api'
import { db } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { Gallery, SignedImage } from '../components/Gallery'
import { Button } from '../components/ui/button'
import { Empty, ErrorBox, Feedback, Field, Loading, PageHeader, Pagination, RequireLogin } from '../components/ui/shared'
import type { Army } from '../types/domain'

export function ArmyCards({ armies }: { armies: Army[] }) {
  return <div className="card-grid">{armies.map(a => <Link className="army-card panel" key={a.id} to={`/armies/${a.id}`}>
    {a.main_image_path ? <SignedImage kind="army" path={a.main_image_path} caption={a.name} /> : <div className="army-emblem"><Swords size={40} strokeWidth={1} /></div>}
    <p className="eyebrow">{a.faction}</p><h2>{a.name}</h2><p className="muted">{a.subfaction || 'Independent force'}</p>
  </Link>)}</div>
}
export function ArmiesPage() {
  const [page, setPage] = useState(0)
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['armies'], queryFn: () => api.armies() })
  const visible = q.data?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) || []
  return <><PageHeader eyebrow="MUSTER ROLLS" title="Armies of the galaxy" action={user && <Button asChild><Link to="/armies/new"><Plus size={16} />Muster army</Link></Button>}>Every force has a story. These are the armies writing the next chapter.</PageHeader>
    <ErrorBox error={q.error} />{q.isPending ? <Loading /> : q.data?.length ? <ArmyCards armies={visible} /> : !q.error && <Empty>No armies have mustered yet.</Empty>}
    <Pagination page={page} count={visible.length} onPage={setPage} />
  </>
}
export function ArmyFormPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const action = useAction()
  const navigate = useNavigate()
  const q = useQuery({ queryKey: ['army', id], queryFn: () => api.army(id!), enabled: !!id })
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = { name: String(form.get('name')), faction: String(form.get('faction')), subfaction: String(form.get('subfaction')), description: String(form.get('description')) }
    await action.run(() => api.saveArmy(data, id), army => navigate(`/armies/${army.id}`))
  }
  return <RequireLogin user={user}><div className="narrow"><PageHeader title={id ? 'Edit army' : 'Muster a new army'} />
    <ErrorBox error={q.error} />{id && q.isPending ? <Loading /> : (!id || q.data) && <form className="panel stack" onSubmit={submit} key={q.data?.id || 'new'}><Feedback action={action} />
      <Field label="Army name"><input name="name" required maxLength={120} defaultValue={q.data?.name} /></Field>
      <div className="form-grid"><Field label="Faction"><input name="faction" required maxLength={120} defaultValue={q.data?.faction} /></Field><Field label="Subfaction"><input name="subfaction" maxLength={120} defaultValue={q.data?.subfaction} /></Field></div>
      <Field label="Description and lore"><textarea name="description" rows={7} maxLength={10000} defaultValue={q.data?.description} /></Field>
      <Button type="submit" disabled={action.pending}>Save army</Button>
    </form>}</div></RequireLogin>
}
export function ArmyPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const action = useAction()
  const q = useQuery({ queryKey: ['army', id], queryFn: () => api.army(id) })
  const admins = useQuery({ queryKey: ['admins', user?.id], queryFn: api.admins, enabled: !!user })
  if (q.isPending) return <Loading />
  if (!q.data) return <ErrorBox error={q.error} />
  const a = q.data
  const owner = user?.id === a.owner_id
  const moderate = admins.data?.some(r => r.player_id === user?.id) || false
  return <><PageHeader eyebrow={a.faction} title={a.name} action={(owner || moderate) && <Button asChild variant="outline"><Link to={`/armies/${id}/edit`}>Edit army</Link></Button>}>
    <p>{a.subfaction}</p><Link to={`/players/${a.owner_id}`}>View commander →</Link></PageHeader><Feedback action={action} />
    <section className="panel"><p className="prose">{a.description || 'No army lore recorded.'}</p></section>
    <Gallery kind="army" id={id} canUpload={owner} canModerate={moderate}
      onMain={owner ? async path => {
        const { error } = await db().from('armies').update({ main_image_path: path }).eq('id', id)
        if (error) throw error
      } : undefined} />
  </>
}
