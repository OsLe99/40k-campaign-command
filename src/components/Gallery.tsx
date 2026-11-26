import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react'
import { deleteImage, images, retryImageCleanup, uploadImage, type GalleryKind } from '../services/api'
import { db } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { Button } from './ui/button'
import { Empty, ErrorBox, Feedback, Field, Loading } from './ui/shared'
import type { ImageRecord } from '../types/domain'

export function SignedImage({ kind, path, caption, eager = false }: { kind: GalleryKind; path: string; caption: string; eager?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('')
  const query = useQuery({
    queryKey: ['signed-image', kind, path],
    queryFn: async () => {
      const { data, error } = await db().storage.from(`${kind}-images`).createSignedUrl(path, 600)
      if (error) throw error
      return data.signedUrl
    },
    staleTime: 240000,
    refetchInterval: 300000,
  })
  if (query.error) return <ErrorBox error={query.error} />
  if (query.data && failedUrl === query.data) return <ErrorBox error="Unable to display this photograph. Try reopening it or refreshing the page." />
  return query.data ? <img src={query.data} alt={caption || 'Campaign miniature photograph'} loading={eager ? 'eager' : 'lazy'} onError={() => setFailedUrl(query.data!)} /> : <Loading />
}
function PhotoViewer({ kind, image, index, total, onClose, onNavigate }: {
  kind: GalleryKind; image: ImageRecord; index: number; total: number; onClose: () => void; onNavigate: (direction: number) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const captionId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog ref={ref} className="photo-viewer" aria-labelledby={titleId} aria-describedby={captionId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}
    onKeyDown={event => {
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
      if (total > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        onNavigate(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }}>
    <div className="photo-viewer-header"><h2 id={titleId}>{kind === 'army' ? 'Army photographs' : 'Battle photographs'}</h2>
      <Button variant="outline" aria-label="Close photo viewer" onClick={onClose}><X size={18} />Close</Button>
    </div>
    <div className="photo-viewer-image"><SignedImage key={image.id} kind={kind} path={image.object_path} caption={image.caption} eager /></div>
    <div className="photo-viewer-footer">
      <p id={captionId}>{image.caption || 'Untitled photograph'}</p>
      <div className="photo-viewer-navigation">
        <Button variant="outline" aria-label="Previous photograph" disabled={total < 2} onClick={() => onNavigate(-1)}><ChevronLeft size={18} />Previous</Button>
        <span role="status" aria-live="polite">{index + 1} / {total}</span>
        <Button variant="outline" aria-label="Next photograph" disabled={total < 2} onClick={() => onNavigate(1)}>Next<ChevronRight size={18} /></Button>
      </div>
    </div>
  </dialog>
}
export function Gallery({ kind, id, canUpload, canModerate = false, onMain }: {
  kind: GalleryKind; id: string; canUpload: boolean; canModerate?: boolean; onMain?: (path: string) => Promise<unknown>
}) {
  const { user } = useAuth()
  const action = useAction()
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['images', kind, id], queryFn: () => images(kind, id) })
  const selectedIndex = query.data?.findIndex(image => image.id === selectedId) ?? -1
  const selected = query.data?.[selectedIndex]
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file || !user) return
    const form = e.currentTarget
    await action.run(() => uploadImage(kind, id, user.id, file, caption), () => { setFile(null); setCaption(''); form.reset() })
  }
  return <section className="panel"><h2>Field photographs</h2><Feedback action={action} /><ErrorBox error={query.error} />
    {query.isPending ? <Loading /> : query.data?.length ? <><p className="muted">Select a photograph to view the full image. Use the arrow keys or Previous/Next to browse.</p><div className="gallery">{query.data.map((image, index) =>
      <figure key={image.id}><button type="button" className="gallery-thumbnail" aria-label={`View photograph ${index + 1}: ${image.caption || 'Untitled photograph'}`} onClick={() => setSelectedId(image.id)}>
        <SignedImage kind={kind} path={image.object_path} caption={image.caption} /><span className="gallery-expand" aria-hidden="true">View full size</span>
      </button><figcaption>{image.caption || 'Untitled photograph'}</figcaption>
        <div className="actions">{onMain && <Button variant="outline" disabled={action.pending} onClick={() => action.run(() => onMain(image.object_path))}>Set main image</Button>}
          {(image.uploaded_by === user?.id || canModerate) && <Button variant="destructive" disabled={action.pending} onClick={() => {
            if (window.confirm('Remove this photograph permanently?')) void action.run(() => deleteImage(kind, image.id, image.object_path))
          }}>Remove</Button>}</div></figure>)}</div></> : !query.error && <Empty>No photographs uploaded yet.</Empty>}
    {selected && <PhotoViewer kind={kind} image={selected} index={selectedIndex} total={query.data!.length} onClose={() => setSelectedId(null)}
      onNavigate={direction => {
        const rows = query.data!
        setSelectedId(rows[(selectedIndex + direction + rows.length) % rows.length].id)
      }} />}
    {canUpload && <form onSubmit={submit} className="stack upload-form"><h3><ImagePlus size={18} />Add a photograph</h3>
      <Field label="Image" hint="JPEG, PNG, or WebP. Maximum 8 MiB."><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
      <Field label="Caption"><input maxLength={500} value={caption} onChange={e => setCaption(e.target.value)} /></Field>
      <div className="actions"><Button type="submit" disabled={action.pending || !file}>Upload photograph</Button><Button variant="ghost" disabled={action.pending} onClick={() => action.run(retryImageCleanup)}>Retry cleanup</Button></div>
    </form>}
  </section>
}
