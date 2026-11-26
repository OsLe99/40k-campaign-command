import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ArmyLists } from '../components/ArmyLists'
import type { ArmyList } from '../types/domain'

const services = vi.hoisted(() => ({
  armyLists: vi.fn(), armyListDownload: vi.fn(), removeArmyList: vi.fn(), retryArmyListCleanup: vi.fn(), uploadArmyList: vi.fn(),
}))
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('../services/armyLists', () => services)
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }))
const list: ArmyList = { id: 'list', army_id: 'army', uploaded_by: 'owner', object_path: 'path', label: 'November roster', file_name: 'newrecruit.json', file_size: 1024, file_extension: 'json', uploaded_at: '2026-11-26T00:00:00Z' }
function view(canUpload = false, canModerate = false) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ArmyLists armyId="army" canUpload={canUpload} canModerate={canModerate} />
  </QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks()
  auth.user = null
  services.armyLists.mockResolvedValue([list])
  services.uploadArmyList.mockResolvedValue(undefined)
  services.removeArmyList.mockResolvedValue(undefined)
})
afterEach(() => { vi.restoreAllMocks() })

it('allows visitors to download but not upload or remove', async () => {
  view()
  expect(await screen.findByRole('heading', { name: 'November roster' })).toBeVisible()
  expect(screen.getByText('newrecruit.json')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Download November roster' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Army list file/)).not.toBeInTheDocument()
})
it('shows public-download notice and attaches a file without replacing earlier lists', async () => {
  auth.user = { id: 'owner' }
  view(true)
  expect(screen.getByText(/Anyone viewing this public army page/)).toBeVisible()
  const file = new File(['{"roster":{}}'], 'my-roster.json', { type: 'application/json' })
  await userEvent.upload(screen.getByLabelText(/Army list file/), file)
  await userEvent.type(screen.getByLabelText(/List label/), 'New roster')
  expect(screen.getByRole('button', { name: 'Attach list' })).toBeEnabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Attach list' }).closest('form')!)
  await waitFor(() => expect(services.uploadArmyList).toHaveBeenCalledWith('army', 'owner', file, 'New roster'))
  expect(await screen.findByRole('heading', { name: 'November roster' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Attach list' })).toBeDisabled()
})
it('rejects invalid files with actionable feedback before calling upload', async () => {
  auth.user = { id: 'owner' }
  view(true)
  await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText(/Army list file/), new File(['bad'], 'bad.html'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JSON')
  expect(screen.getByRole('button', { name: 'Attach list' })).toBeDisabled()
  expect(services.uploadArmyList).not.toHaveBeenCalled()
})
it('offers retryable errors for failed uploads', async () => {
  auth.user = { id: 'owner' }
  services.uploadArmyList.mockRejectedValue(new Error('Use Retry list cleanup'))
  view(true)
  await userEvent.upload(screen.getByLabelText(/Army list file/), new File(['list'], 'list.txt'))
  expect(screen.getByRole('button', { name: 'Attach list' })).toBeEnabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Attach list' }).closest('form')!)
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry list cleanup')
  await userEvent.click(screen.getByRole('button', { name: 'Retry list cleanup' }))
  expect(services.retryArmyListCleanup).toHaveBeenCalledWith('owner', 'army')
})
it('allows a global moderator to remove but not upload, with confirmation', async () => {
  auth.user = { id: 'moderator' }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  view(false, true)
  const remove = await screen.findByRole('button', { name: 'Remove November roster' })
  await userEvent.click(remove)
  expect(services.removeArmyList).not.toHaveBeenCalled()
  await userEvent.click(remove)
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(services.removeArmyList).toHaveBeenCalledWith(list)
  expect(screen.queryByLabelText(/Army list file/)).not.toBeInTheDocument()
})
it('surfaces removal errors without hiding the attachment entry', async () => {
  auth.user = { id: 'owner' }
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  services.removeArmyList.mockRejectedValue(new Error('Retry Remove to finish cleanup'))
  view(true)
  await userEvent.click(await screen.findByRole('button', { name: 'Remove November roster' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry Remove')
  expect(screen.getByRole('button', { name: 'Remove November roster' })).toBeEnabled()
})
it('requests a fresh download when clicked and reports signing failures', async () => {
  services.armyListDownload.mockRejectedValue(new Error('Download unavailable'))
  view()
  await userEvent.click(await screen.findByRole('button', { name: 'Download November roster' }))
  expect(services.armyListDownload).toHaveBeenCalledWith(list)
  expect(await screen.findByRole('alert')).toHaveTextContent('Download unavailable')
})
it('distinguishes an empty army from a failed attachment query', async () => {
  services.armyLists.mockResolvedValueOnce([])
  const first = view()
  expect(await screen.findByText('No army lists attached yet.')).toBeVisible()
  first.unmount()
  services.armyLists.mockRejectedValue(new Error('Unable to load lists'))
  view()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load lists')
  expect(screen.queryByText('No army lists attached yet.')).not.toBeInTheDocument()
})
