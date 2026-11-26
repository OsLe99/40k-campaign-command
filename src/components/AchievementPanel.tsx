import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { achievementProgress } from '../lib/achievements'
import { Badge, ErrorBox, Loading } from './ui/shared'

export function AchievementPanel({ playerId, campaignId, children }: { playerId: string; campaignId?: string; children?: ReactNode }) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['achievements', playerId, campaignId || 'overall', user?.id || 'anonymous'],
    queryFn: () => api.achievementSummary(playerId, campaignId),
  })
  const milestones = query.data ? achievementProgress(query.data, !!campaignId) : []
  return <section className="panel achievement-panel" aria-label={campaignId ? 'Campaign achievements' : 'Automatic achievements'}>
    <h2>{campaignId ? 'Campaign achievements' : 'Automatic achievements'}</h2>
    {children}
    <p className="muted">{campaignId ? 'Progress for this commander in this campaign only.' : 'Progress across all campaigns visible to you. Campaign Regular uses the best single campaign.'}</p>
    <p className="muted">Only confirmed battles you can access count. Private history stays private; corrections and campaign changes can adjust milestones.</p>
    <ErrorBox error={query.error} />
    {query.isPending ? <Loading /> : !query.error && query.data && <>
      <p className="muted">{milestones.filter(item => item.earned).length} / {milestones.length} milestones earned · {query.data.played} confirmed {query.data.played === 1 ? 'battle' : 'battles'} visible</p>
      <ul className="achievement-grid">{milestones.map(item => <li key={item.id} className={`achievement-card${item.earned ? ' achievement-card-earned' : ''}`}>
        <div className="achievement-card-header"><Trophy size={24} aria-hidden="true" /><Badge>{item.earned ? 'Earned' : 'Locked'}</Badge></div>
        <h3>{item.name}</h3><p>{item.criteria}</p>
        <progress value={item.progress} max={item.target} aria-label={`${item.name} progress`} />
        <small>{item.progress} / {item.target}{item.id === 'campaign-regular' && !campaignId ? ' in best campaign' : ''}</small>
      </li>)}</ul>
    </>}
  </section>
}
