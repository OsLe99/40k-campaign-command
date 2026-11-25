import type { Tables } from './database.generated'
import type { ThemeId } from '../lib/themes'
export type CampaignStatus = 'Upcoming' | 'Active' | 'Completed'
export type BattleStatus = 'Pending' | 'Confirmed' | 'Disputed' | 'Rejected'
export type Result = 'Win' | 'Loss' | 'Draw'
export type Profile = Omit<Tables<'profiles'>, 'theme'> & { theme: ThemeId }
export type Campaign = Omit<Tables<'campaigns'>, 'status'> & { status: CampaignStatus }
export type Member = Omit<Tables<'campaign_members'>, 'role'> & { role: 'Member' | 'CampaignAdmin' }
export type Army = Tables<'armies'>
export type Battle = Omit<Tables<'battles'>, 'status'> & { status: BattleStatus }
export type Participant = Omit<Tables<'battle_participants'>, 'result'> & { result: Result }
export type BattleResponse = Omit<Tables<'battle_responses'>, 'response'> & { response: 'Confirmed' | 'Disputed' }
export type ImageRecord = Omit<Tables<'army_images'>, 'army_id'>
export type Audit = Tables<'moderation_log'>
// The view selects non-null member/profile columns and count/coalesce aggregates.
// PostgreSQL's generated view metadata conservatively marks every column nullable.
export type Standing = { [K in keyof Tables<'standings'>]: NonNullable<Tables<'standings'>[K]> }
export type ParticipantInput = { player_id: string; army_id: string; result: Result; victory_points: number | null }
export type BattleInput = { mission: string; description: string; points_limit: number | null; battle_date: string; participants: ParticipantInput[] }
