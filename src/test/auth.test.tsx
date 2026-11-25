import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthPage } from '../pages/AuthPage'
import { authCallbackError } from '../lib/auth'

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  db: () => ({ auth: { signInWithOAuth } }),
  authRedirect: () => 'https://osle99.github.io/40k-campaign-command/',
  supabase: null,
}))

function renderAuth() {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthPage /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { signInWithOAuth.mockReset() })

describe('Discord sign-in', () => {
  it('is available for sign-in and registration, not verification resend', async () => {
    renderAuth()
    expect(screen.getByRole('button', { name: 'Continue with Discord' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByRole('button', { name: 'Continue with Discord' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Resend email' }))
    expect(screen.queryByRole('button', { name: 'Continue with Discord' })).not.toBeInTheDocument()
  })
  it('uses Discord and the application redirect without requiring email or password', async () => {
    signInWithOAuth.mockResolvedValue({ data: { provider: 'discord', url: 'https://discord.com/oauth2/authorize' }, error: null })
    renderAuth()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }))
    expect(signInWithOAuth).toHaveBeenCalledExactlyOnceWith({
      provider: 'discord', options: { redirectTo: 'https://osle99.github.io/40k-campaign-command/' },
    })
    expect(screen.getByRole('button', { name: 'Connecting to Discord…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Redirecting to Discord')
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()
    expect(screen.queryByText('Saved successfully.')).not.toBeInTheDocument()
  })
  it('blocks competing actions while the provider request is pending', async () => {
    let finish!: (result: { error: null }) => void
    signInWithOAuth.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    renderAuth()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }))
    await userEvent.click(screen.getByRole('button', { name: 'Connecting to Discord…' }))
    expect(signInWithOAuth).toHaveBeenCalledTimes(1)
    finish({ error: null })
    expect(await screen.findByRole('status')).toHaveTextContent('Redirecting to Discord')
  })
  it('displays provider errors and allows retry', async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: 'Discord provider is not enabled' } })
    renderAuth()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Discord provider is not enabled')
    expect(screen.getByRole('button', { name: 'Continue with Discord' })).toBeEnabled()
    expect(screen.getByLabelText('Email')).toBeEnabled()
  })
  it('displays network failures and preserves the email fallback', async () => {
    signInWithOAuth.mockRejectedValue(new Error('Unable to reach authentication service'))
    renderAuth()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Discord' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach authentication service')
    expect(screen.getByLabelText(/Password/)).toBeEnabled()
  })
})

describe('OAuth callback errors', () => {
  it('reads query and OAuth fragment errors', () => {
    expect(authCallbackError(new URL('https://example.com/?error=access_denied&error_description=Discord+access+denied'))).toBe('Discord access denied')
    expect(authCallbackError(new URL('https://example.com/#error=access_denied&error_description=Authorization+cancelled'))).toBe('Authorization cancelled')
    expect(authCallbackError(new URL('https://example.com/#error=access_denied'))).toMatch(/cancelled/)
    expect(authCallbackError(new URL('https://example.com/?error=server_error'))).toMatch(/Unable to complete sign-in/)
  })
  it('leaves successful callbacks and HashRouter paths alone', () => {
    expect(authCallbackError(new URL('https://example.com/?code=example-code'))).toBe('')
    expect(authCallbackError(new URL('https://example.com/#/auth?error_description=not-a-callback'))).toBe('')
  })
})
