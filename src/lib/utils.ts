import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Standing } from '../types/domain'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function message(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Something went wrong. Please try again.'
}
export function date(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Date(`${value.substring(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
export function rankStandings(rows: Standing[]) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.wins - a.wins || a.username.localeCompare(b.username))
  let rank = 1
  return sorted.map((row, i) => {
    if (i && (row.points !== sorted[i - 1].points || row.wins !== sorted[i - 1].wins)) rank = i + 1
    return { ...row, rank }
  })
}
export function validateImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be 8 MiB or smaller.')
}
