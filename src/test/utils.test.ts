import { describe, expect, it } from 'vitest'
import { message, rankStandings, validateImage } from '../lib/utils'
import { unwrap } from '../services/api'
import type { Standing } from '../types/domain'
import { publicConfigError } from '../lib/config'

const row = (username: string, points: number, wins: number): Standing => ({
  username, display_name: username, player_id: username, campaign_id: 'campaign', points, wins, played: 0, losses: 0, draws: 0,
})
describe('public-only configuration', () => {
  it('rejects missing settings and invalid URLs without crashing', () => {
    expect(publicConfigError('', '')).toMatch(/missing/)
    expect(publicConfigError('not a url', 'sb_publishable_test')).toMatch(/valid/)
  })
  it('rejects privileged keys and accepts publishable keys', () => {
    expect(publicConfigError('https://example.supabase.co', 'sb_secret_test')).toMatch(/privileged/)
    expect(publicConfigError('https://example.supabase.co', 'sb_publishable_test')).toBe('')
  })
  it('checks the role inside legacy JWT configuration', () => {
    const key = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`
    expect(publicConfigError('http://localhost:54321', key('service_role'))).toMatch(/anon/)
    expect(publicConfigError('http://localhost:54321', key('anon'))).toBe('')
  })
})
describe('standings', () => {
  it('sorts points, then wins, then stable usernames without mutating input', () => {
    const rows = [row('zeta', 3, 0), row('beta', 6, 2), row('alpha', 6, 2), row('delta', 3, 1)]
    const result = rankStandings(rows)
    expect(result.map(r => [r.username, r.rank])).toEqual([['alpha', 1], ['beta', 1], ['delta', 3], ['zeta', 4]])
    expect(rows[0].username).toBe('zeta')
  })
  it('supports empty standings', () => expect(rankStandings([])).toEqual([]))
})
describe('service and upload errors', () => {
  it('preserves server errors and string feedback', () => {
    const error = { message: 'Permission denied' }
    expect(() => unwrap({ data: null, error })).toThrow()
    expect(message(error)).toBe('Permission denied')
    expect(message('Session expired')).toBe('Session expired')
  })
  it('returns successful data', () => expect(unwrap({ data: ['ok'], error: null })).toEqual(['ok']))
  it('accepts supported images', () => expect(() => validateImage(new File(['x'], 'army.png', { type: 'image/png' }))).not.toThrow())
  it('rejects executable and SVG uploads', () => expect(() => validateImage(new File(['x'], 'army.svg', { type: 'image/svg+xml' }))).toThrow('JPEG'))
  it('rejects oversized images', () => expect(() => validateImage(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).toThrow('8 MiB'))
})
