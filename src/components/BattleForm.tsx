import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAction } from '../hooks/useAction'
import { useAuth } from '../contexts/AuthContext'
import type { BattleInput, ParticipantInput, Result } from '../types/domain'
import { Button } from './ui/button'
import { ErrorBox, Feedback, Field, Loading } from './ui/shared'

export function BattleForm({ campaignId, initial, onSave }: { campaignId: string; initial?: BattleInput; onSave: (data: BattleInput) => Promise<unknown> }) {
  const { user } = useAuth()
  const action = useAction()
  const profiles = useQuery({ queryKey: ['profiles'], queryFn: api.profiles })
  const members = useQuery({ queryKey: ['members', campaignId], queryFn: () => api.members(campaignId) })
  const armies = useQuery({ queryKey: ['armies'], queryFn: () => api.armies() })
  const registrations = useQuery({ queryKey: ['registrations', campaignId], queryFn: () => api.registrations(campaignId) })
  const empty: ParticipantInput = { player_id: '', army_id: '', result: 'Loss', victory_points: null }
  const [participants, setParticipants] = useState<ParticipantInput[]>(initial?.participants || [{ ...empty, player_id: user?.id || '', result: 'Win' }, { ...empty }])
  function update(index: number, value: Partial<ParticipantInput>) {
    setParticipants(rows => rows.map((row, i) => i === index ? { ...row, ...value } : row))
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await action.run(async () => {
      if (new Set(participants.map(p => p.player_id)).size !== participants.length) throw new Error('Select distinct commanders.')
      const wins = participants.filter(p => p.result === 'Win').length
      const draws = participants.filter(p => p.result === 'Draw').length
      if (!((wins === 1 && draws === 0) || draws === participants.length)) throw new Error('Choose one winner and remaining losses, or all draws.')
      await onSave({
        mission: String(f.get('mission')).trim(), description: String(f.get('description')),
        battle_date: String(f.get('battle_date')), points_limit: f.get('points_limit') ? Number(f.get('points_limit')) : null, participants,
      })
    })
  }
  const registered = new Set(registrations.data?.map(r => r.army_id))
  return <form className="panel stack" onSubmit={submit}><Feedback action={action} /><ErrorBox error={profiles.error || members.error || armies.error || registrations.error} />
    {(members.isPending || armies.isPending || registrations.isPending) && <Loading />}
    <Field label="Mission"><input name="mission" required maxLength={160} defaultValue={initial?.mission} /></Field>
    <div className="form-grid"><Field label="Battle date"><input type="date" name="battle_date" required defaultValue={initial?.battle_date || new Date().toISOString().slice(0, 10)} /></Field>
      <Field label="Points limit (optional)"><input name="points_limit" type="number" min={1} step={1} defaultValue={initial?.points_limit || ''} /></Field></div>
    <div><h2>Opposing forces</h2><p className="muted">2–20 distinct players. Each must be an active member with a registered army. One winner, or all draws.</p></div>
    {participants.map((p, i) => <fieldset className="participant-form" key={i}><legend>Participant {i + 1}</legend><div className="form-grid">
      <Field label="Commander"><select required value={p.player_id} onChange={e => update(i, { player_id: e.target.value, army_id: '' })}><option value="">Choose commander</option>{members.data?.filter(m => m.is_active).map(m => <option key={m.player_id} value={m.player_id}>{profiles.data?.find(pr => pr.id === m.player_id)?.display_name || m.player_id}</option>)}</select></Field>
      <Field label="Registered army"><select required value={p.army_id} onChange={e => update(i, { army_id: e.target.value })}><option value="">Choose army</option>{armies.data?.filter(a => a.owner_id === p.player_id && registered.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field label="Result"><select value={p.result} onChange={e => update(i, { result: e.target.value as Result })}>{['Win', 'Loss', 'Draw'].map(r => <option key={r}>{r}</option>)}</select></Field>
      <Field label="Victory points (optional)"><input type="number" min={0} step={1} value={p.victory_points ?? ''} onChange={e => update(i, { victory_points: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
    </div>{participants.length > 2 && <Button variant="ghost" onClick={() => setParticipants(rows => rows.filter((_, index) => index !== i))}>Remove participant</Button>}</fieldset>)}
    <Button variant="outline" disabled={participants.length >= 20} onClick={() => setParticipants(rows => [...rows, { ...empty }])}>Add participant</Button>
    <Field label="Battle report"><textarea name="description" rows={8} maxLength={20000} defaultValue={initial?.description} placeholder="Record the story of the battle…" /></Field>
    <p className="muted">{initial ? 'Corrections reset all confirmations. Every participant must reconfirm this revision.' : 'Your result is attested on submission. Opponents must confirm before the battle counts.'}</p>
    <Button type="submit" disabled={action.pending || members.isPending || armies.isPending || registrations.isPending}>{action.pending ? 'Recording…' : initial ? 'Submit correction' : 'Submit battle report'}</Button>
  </form>
}
