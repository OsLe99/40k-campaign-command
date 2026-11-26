import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AchievementPanel } from '../components/AchievementPanel'
import { api } from '../services/api'
import type { AchievementSummary } from '../types/domain'

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }))
const zero: AchievementSummary = { played: 0, wins: 0, draws: 0, opponents: 0, best_campaign: 0, completed_campaigns: 0 }
function panel(client: QueryClient, campaignId?: string) {
  return <QueryClientProvider client={client}><AchievementPanel playerId="commander" campaignId={campaignId} /></QueryClientProvider>
}
function view(campaignId?: string) {
  return render(panel(new QueryClient({ defaultOptions: { queries: { retry: false } } }), campaignId))
}
beforeEach(() => {
  auth.user = null
  vi.spyOn(api, 'achievementSummary').mockResolvedValue(zero)
})
afterEach(() => { vi.restoreAllMocks() })

it('shows seven locked milestones and clear privacy/recalculation rules for zero history', async () => {
  view()
  expect(await screen.findByText('0 / 7 milestones earned · 0 confirmed battles visible')).toBeVisible()
  expect(screen.getAllByText('Locked')).toHaveLength(7)
  expect(screen.getAllByRole('progressbar')).toHaveLength(7)
  expect(screen.getByText(/Private history stays private/)).toBeVisible()
})
it('shows earned and partial progress with bounded progress bars', async () => {
  vi.mocked(api.achievementSummary).mockResolvedValue({ ...zero, played: 25, wins: 1, opponents: 3, best_campaign: 4 })
  view()
  expect(await screen.findByText('3 / 7 milestones earned · 25 confirmed battles visible')).toBeVisible()
  expect(screen.getByRole('progressbar', { name: 'Veteran Commander progress' })).toHaveAttribute('value', '20')
  expect(screen.getByRole('progressbar', { name: 'Campaign Regular progress' })).toHaveAttribute('value', '4')
  const card = screen.getByRole('heading', { name: 'Campaign Regular' }).closest('li')!
  expect(within(card).getByText('Locked')).toBeVisible()
  expect(within(card).getByText('4 / 5 in best campaign')).toBeVisible()
})
it('uses campaign-scoped metrics and six milestones', async () => {
  view('campaign')
  expect(await screen.findByText('0 / 6 milestones earned · 0 confirmed battles visible')).toBeVisible()
  expect(api.achievementSummary).toHaveBeenCalledWith('commander', 'campaign')
  expect(screen.queryByRole('heading', { name: 'Veteran Commander' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Campaign achievements' })).toBeVisible()
})
it('shows loading rather than fabricated zero progress while waiting', () => {
  vi.mocked(api.achievementSummary).mockReturnValue(new Promise(() => {}))
  view()
  expect(screen.getByRole('status')).toBeVisible()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})
it('shows a fetch error without displaying stale earned cards', async () => {
  vi.mocked(api.achievementSummary).mockRejectedValue(new Error('Unable to load achievements'))
  view()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load achievements')
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})
it('does not reuse one viewers private totals for a different viewer', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } })
  auth.user = { id: 'member' }
  vi.mocked(api.achievementSummary).mockResolvedValueOnce({ ...zero, played: 25 })
  const rendered = render(panel(client))
  expect(await screen.findByText(/25 confirmed battles visible/)).toBeVisible()
  auth.user = null
  vi.mocked(api.achievementSummary).mockResolvedValueOnce(zero)
  rendered.rerender(panel(client))
  expect(screen.queryByText(/25 confirmed battles visible/)).not.toBeInTheDocument()
  expect(await screen.findByText(/0 confirmed battles visible/)).toBeVisible()
  expect(api.achievementSummary).toHaveBeenCalledTimes(2)
})
