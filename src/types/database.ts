import type { Database as GeneratedDatabase } from './database.generated'
import type { Battle, BattleResponse, Campaign, Member, Participant, Profile, Standing } from './domain'

export type { Json } from './database.generated'
type PublicSchema = GeneratedDatabase['public']
type RefinedRows = {
  profiles: Profile
  campaigns: Campaign
  campaign_members: Member
  battles: Battle
  battle_participants: Participant
  battle_responses: BattleResponse
}

// Keep generated inserts, updates, relationships, and RPC signatures authoritative.
// Only refine CHECK-constrained text unions and known non-null view expressions.
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<PublicSchema, 'Tables' | 'Views'> & {
    Tables: {
      [N in keyof PublicSchema['Tables']]: N extends keyof RefinedRows
        ? Omit<PublicSchema['Tables'][N], 'Row'> & { Row: RefinedRows[N] }
        : PublicSchema['Tables'][N]
    }
    Views: {
      standings: Omit<PublicSchema['Views']['standings'], 'Row'> & { Row: Standing }
    }
  }
}
