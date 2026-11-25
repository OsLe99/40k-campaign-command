import { expectTypeOf, it } from 'vitest'
import type { Database } from '../types/database'
import type { Database as NativeDatabase } from '../types/database.generated'
import type { Battle, Campaign, Participant, Standing } from '../types/domain'

it('preserves generated write contracts, relationships, and RPC signatures', () => {
  type Public = Database['public']
  type Native = NativeDatabase['public']
  expectTypeOf<Public['Functions']>().toEqualTypeOf<Native['Functions']>()
  expectTypeOf<Public['Tables']['campaigns']['Insert']>().toEqualTypeOf<Native['Tables']['campaigns']['Insert']>()
  expectTypeOf<Public['Tables']['battles']['Update']>().toEqualTypeOf<Native['Tables']['battles']['Update']>()
  expectTypeOf<Public['Tables']['armies']['Relationships']>().toEqualTypeOf<Native['Tables']['armies']['Relationships']>()
})

it('only narrows database-constrained text values and non-null view expressions', () => {
  expectTypeOf<Campaign>().toExtend<NativeDatabase['public']['Tables']['campaigns']['Row']>()
  expectTypeOf<Battle>().toExtend<NativeDatabase['public']['Tables']['battles']['Row']>()
  expectTypeOf<Participant>().toExtend<NativeDatabase['public']['Tables']['battle_participants']['Row']>()
  expectTypeOf<Standing>().toExtend<NativeDatabase['public']['Views']['standings']['Row']>()
  expectTypeOf<Battle['status']>().toEqualTypeOf<'Pending' | 'Confirmed' | 'Disputed' | 'Rejected'>()
})
