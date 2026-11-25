export function authCallbackError(url: URL) {
  const query = url.searchParams
  const fragment = url.hash.startsWith('#/') ? new URLSearchParams() : new URLSearchParams(url.hash.slice(1))
  for (const params of [query, fragment]) {
    const description = params.get('error_description')
    const error = params.get('error')
    if (description || error) return description || (error === 'access_denied' ? 'Sign-in was cancelled or access was denied. Please try again.' : 'Unable to complete sign-in. Please try again.')
  }
  return ''
}
