import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Gallery } from '../components/Gallery'

const mocks = vi.hoisted(() => ({
  images: vi.fn(), deleteImage: vi.fn(), retryImageCleanup: vi.fn(), uploadImage: vi.fn(), sign: vi.fn(), bucket: vi.fn(),
}))
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('../services/api', () => ({ ...mocks, PAGE_SIZE: 12 }))
vi.mock('../lib/supabase', () => ({ db: () => ({ storage: { from: mocks.bucket } }) }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }))
const photo = { id: 'photo', object_path: 'owner/army/photo.png', caption: 'Painted legion', uploaded_by: 'owner', uploaded_at: '2026-11-26T00:00:00Z' }
function view(kind: 'army' | 'battle' = 'army', canUpload = false, canModerate = false, onMain?: (path: string) => Promise<unknown>) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <Gallery kind={kind} id="entity" canUpload={canUpload} canModerate={canModerate} onMain={onMain} />
  </QueryClientProvider>)
}
beforeEach(() => {
  vi.resetAllMocks()
  auth.user = null
  mocks.images.mockResolvedValue([photo])
  mocks.sign.mockResolvedValue({ data: { signedUrl: 'https://images.example/fixture.png' }, error: null })
  mocks.bucket.mockReturnValue({ createSignedUrl: mocks.sign })
})
afterEach(() => { vi.restoreAllMocks() })

it.each(['army', 'battle'] as const)('displays %s image thumbnails using the existing signed-image permissions', async kind => {
  view(kind)
  expect(await screen.findByRole('button', { name: 'View photograph 1: Painted legion' })).toBeVisible()
  expect(await screen.findByRole('img', { name: 'Painted legion' })).toHaveAttribute('loading', 'lazy')
  expect(mocks.images).toHaveBeenCalledWith(kind, 'entity')
  expect(mocks.bucket).toHaveBeenCalledWith(`${kind}-images`)
  expect(mocks.sign).toHaveBeenCalledWith(photo.object_path, 600)
  expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Upload photograph' })).not.toBeInTheDocument()
})
it('keeps owner upload, removal, and main-image controls available', async () => {
  auth.user = { id: 'owner' }
  const main = vi.fn().mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  view('army', true, false, main)
  await userEvent.click(await screen.findByRole('button', { name: 'Set main image' }))
  expect(main).toHaveBeenCalledWith(photo.object_path)
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(mocks.deleteImage).toHaveBeenCalledWith('army', photo.id, photo.object_path)
  expect(screen.getByRole('button', { name: 'Upload photograph' })).toBeDisabled()
})
it('keeps moderation removal independent of upload permission', async () => {
  auth.user = { id: 'moderator' }
  view('battle', false, true)
  expect(await screen.findByRole('button', { name: 'Remove' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Upload photograph' })).not.toBeInTheDocument()
})
it('shows a useful error if the image bytes cannot load', async () => {
  view()
  fireEvent.error(await screen.findByRole('img', { name: 'Painted legion' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to display this photograph')
})
it('surfaces signed-URL failures', async () => {
  mocks.sign.mockResolvedValue({ data: null, error: new Error('Image access denied') })
  view()
  expect(await screen.findByRole('alert')).toHaveTextContent('Image access denied')
})
it('distinguishes empty galleries from failed image queries', async () => {
  mocks.images.mockResolvedValueOnce([])
  const first = view()
  expect(await screen.findByText('No photographs uploaded yet.')).toBeVisible()
  first.unmount()
  mocks.images.mockRejectedValue(new Error('Gallery unavailable'))
  view()
  expect(await screen.findByRole('alert')).toHaveTextContent('Gallery unavailable')
  expect(screen.queryByText('No photographs uploaded yet.')).not.toBeInTheDocument()
})
