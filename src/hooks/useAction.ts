import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { message } from '../lib/utils'

export function useAction() {
  const cache = useQueryClient()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  async function run<T>(task: () => Promise<T>, success?: (value: T) => void) {
    setError(''); setNotice(''); setPending(true)
    try {
      const value = await task()
      await cache.invalidateQueries()
      setNotice('Saved successfully.')
      success?.(value)
      return true
    } catch (e) { setError(message(e)); return false }
    finally { setPending(false) }
  }
  return { run, error, pending, notice }
}
