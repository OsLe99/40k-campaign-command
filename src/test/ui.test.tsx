import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SetupScreen } from '../App'
import { Pagination, RequireLogin, ErrorBox } from '../components/ui/shared'
import { AuthPage } from '../pages/AuthPage'
import { api } from '../services/api'
import { CampaignsPage } from '../pages/CampaignsPage'

function wrapper(children: React.ReactNode) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}
describe('application states', () => {
  it('explains missing setup without pretending records are live', () => {
    render(<SetupScreen />)
    expect(screen.getByRole('heading', { name: 'Establish your command link' })).toBeVisible()
    expect(screen.getByText(/No campaign records are being simulated/)).toBeVisible()
  })
  it('blocks anonymous mutation screens', () => {
    render(wrapper(<RequireLogin user={null}><button>Secret action</button></RequireLogin>))
    expect(screen.queryByText('Secret action')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth')
  })
  it('displays meaningful permission errors', () => {
    render(<ErrorBox error="Campaign administrator required" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Campaign administrator required')
  })
  it('disables unavailable pagination actions', async () => {
    const onPage = vi.fn()
    render(<Pagination page={0} count={12} onPage={onPage} />)
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(onPage).toHaveBeenCalledWith(1)
  })
  it('switches auth forms and enforces new-account password length', async () => {
    render(wrapper(<AuthPage />))
    await userEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByLabelText(/Password/)).toHaveAttribute('minlength', '12')
    await userEvent.click(screen.getByRole('button', { name: 'Resend email' }))
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send verification email' })).toBeVisible()
  })
  it('renders empty and failed campaign queries', async () => {
    const spy = vi.spyOn(api, 'campaigns').mockResolvedValueOnce([])
    const view = render(wrapper(<CampaignsPage />))
    expect(await screen.findByText('No campaigns in the archives')).toBeVisible()
    view.unmount()
    spy.mockRejectedValueOnce(new Error('Unable to reach archives'))
    render(wrapper(<CampaignsPage />))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach archives')
    spy.mockRestore()
  })
})
