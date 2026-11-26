import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACHIEVEMENTS, achievementProgress } from '../lib/achievements'
import { api } from '../services/api'
import type { AchievementSummary } from '../types/domain'

const { callRpc } = vi.hoisted(() => ({ callRpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ db: () => ({ rpc: callRpc }) }))
const zero: AchievementSummary = { played: 0, wins: 0, draws: 0, opponents: 0, best_campaign: 0, completed_campaigns: 0 }
beforeEach(() => { callRpc.mockReset() })

describe('automatic milestone rules', () => {
  it('defines seven unique measurable milestones', () => {
    expect(ACHIEVEMENTS).toHaveLength(7)
    expect(new Set(ACHIEVEMENTS.map(item => item.id)).size).toBe(7)
    expect(achievementProgress(zero).every(item => !item.earned && item.progress === 0)).toBe(true)
  })
  for (const definition of ACHIEVEMENTS) {
    it.each([-1, 0, 1])(`${definition.name} handles threshold offset %s`, offset => {
      const current = definition.target + offset
      const summary = { ...zero, [definition.metric]: current }
      const milestone = achievementProgress(summary).find(item => item.id === definition.id)!
      expect(milestone.earned).toBe(offset >= 0)
      expect(milestone.current).toBe(current)
      expect(milestone.progress).toBe(Math.min(current, definition.target))
    })
  }
  it('does not substitute combined battle totals for the best single campaign', () => {
    const progress = achievementProgress({ ...zero, played: 20, best_campaign: 4 })
    expect(progress.find(item => item.id === 'campaign-regular')!.earned).toBe(false)
    expect(progress.find(item => item.id === 'veteran-commander')!.earned).toBe(true)
  })
  it('omits only the overall Veteran Commander milestone from campaign scope', () => {
    const progress = achievementProgress(zero, true)
    expect(progress).toHaveLength(6)
    expect(progress.some(item => item.id === 'veteran-commander')).toBe(false)
  })
  it('recalculates rather than retaining previously earned status or mutating metrics', () => {
    const summary = Object.freeze({ ...zero, played: 5, best_campaign: 5 })
    expect(achievementProgress(summary).find(item => item.id === 'campaign-regular')!.earned).toBe(true)
    expect(achievementProgress(zero).find(item => item.id === 'campaign-regular')!.earned).toBe(false)
    expect(summary.played).toBe(5)
  })
})
describe('achievement API', () => {
  it('requests overall metrics without sending an artificial campaign filter', async () => {
    callRpc.mockResolvedValue({ data: [zero], error: null })
    expect(await api.achievementSummary('commander')).toEqual(zero)
    expect(callRpc).toHaveBeenCalledWith('achievement_summary', { target_player: 'commander' })
  })
  it('passes explicit player and campaign filters', async () => {
    callRpc.mockResolvedValue({ data: [zero], error: null })
    await api.achievementSummary('commander', 'campaign')
    expect(callRpc).toHaveBeenCalledWith('achievement_summary', { target_player: 'commander', target_campaign: 'campaign' })
  })
  it('does not turn errors or missing results into locked achievements', async () => {
    callRpc.mockResolvedValueOnce({ data: null, error: new Error('Metrics unavailable') })
    await expect(api.achievementSummary('commander')).rejects.toThrow('Metrics unavailable')
    callRpc.mockResolvedValueOnce({ data: [], error: null })
    await expect(api.achievementSummary('commander')).rejects.toThrow('Achievement progress is unavailable')
  })
})
