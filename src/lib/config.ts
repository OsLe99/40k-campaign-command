export function publicConfigError(url: string | undefined, key: string | undefined) {
  if (!url || !key) return 'Supabase connection settings are missing.'
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) return 'Supabase URL must use HTTP or HTTPS.'
  } catch { return 'Supabase URL is not valid.' }
  if (key.startsWith('sb_secret_')) return 'A privileged key cannot be used in the browser. Replace it with a publishable key.'
  if (key.split('.').length === 3) {
    try {
      const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      if (JSON.parse(atob(encoded)).role !== 'anon') return 'Only the legacy anon JWT may be used in the browser.'
    } catch { return 'Supabase public key is malformed.' }
  } else if (!key.startsWith('sb_publishable_')) {
    return 'Use a Supabase publishable key or a legacy anon JWT.'
  }
  return ''
}
