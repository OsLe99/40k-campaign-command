import type { AchievementSummary } from '../types/domain'

export const ACHIEVEMENTS = [
  { id: 'first-deployment', name: 'First Deployment', criteria: 'Complete 1 confirmed battle.', metric: 'played', target: 1 },
  { id: 'campaign-regular', name: 'Campaign Regular', criteria: 'Complete 5 confirmed battles in one campaign.', metric: 'best_campaign', target: 5 },
  { id: 'veteran-commander', name: 'Veteran Commander', criteria: 'Complete 20 confirmed battles across campaigns.', metric: 'played', target: 20 },
  { id: 'worthy-adversaries', name: 'Worthy Adversaries', criteria: 'Face 5 distinct opposing commanders in confirmed battles.', metric: 'opponents', target: 5 },
  { id: 'first-victory', name: 'First Victory', criteria: 'Earn 1 confirmed victory.', metric: 'wins', target: 1 },
  { id: 'honours-even', name: 'Honours Even', criteria: 'Finish 1 confirmed battle in a draw.', metric: 'draws', target: 1 },
  { id: 'seeing-it-through', name: 'Seeing It Through', criteria: 'Play a confirmed battle in a campaign currently marked Completed.', metric: 'completed_campaigns', target: 1 },
] as const satisfies ReadonlyArray<{ id: string; name: string; criteria: string; metric: keyof AchievementSummary; target: number }>

export function achievementProgress(summary: AchievementSummary, campaignScope = false) {
  return ACHIEVEMENTS.filter(item => !campaignScope || item.id !== 'veteran-commander').map(item => {
    const current = summary[item.metric]
    return { ...item, current, progress: Math.min(item.target, current), earned: current >= item.target }
  })
}
