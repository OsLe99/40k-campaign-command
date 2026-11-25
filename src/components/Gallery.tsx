import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { deleteImage, images, retryImageCleanup, uploadImage, type GalleryKind } from '../services/api'
import { db } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { Button } from './ui/button'
import { Empty, ErrorBox, Feedback, Field, Loading } from './ui/shared'

export function SignedImage({ kind, path, caption }: { kind: GalleryKind; path: string; caption: string }) {
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
  return query.data ? <img src={query.data} alt={caption || 'Campaign miniature photograph'} loading="lazy" /> : <Loading />
}
export function Gallery({ kind, id, canUpload, canModerate = false, onMain }: {
  kind: GalleryKind; id: string; canUpload: boolean; canModerate?: boolean; onMain?: (path: string) => Promise<unknown>
}) {
  const { user } = useAuth()
  const action = useAction()
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const query = useQuery({ queryKey: ['images', kind, id], queryFn: () => images(kind, id) })
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file || !user) return
    const form = e.currentTarget
    await action.run(() => uploadImage(kind, id, user.id, file, caption), () => { setFile(null); setCaption(''); form.reset() })
  }
  return <section className="panel"><h2>Field photographs</h2><Feedback action={action} /><ErrorBox error={query.error} />
    {query.isPending ? <Loading /> : query.data?.length ? <div className="gallery">{query.data.map(image =>
      <figure key={image.id}><SignedImage kind={kind} path={image.object_path} caption={image.caption} /><figcaption>{image.caption || 'Untitled photograph'}</figcaption>
        <div className="actions">{onMain && <Button variant="outline" disabled={action.pending} onClick={() => action.run(() => onMain(image.object_path))}>Set main image</Button>}
          {(image.uploaded_by === user?.id || canModerate) && <Button variant="destructive" disabled={action.pending} onClick={() => {
            if (window.confirm('Remove this photograph permanently?')) void action.run(() => deleteImage(kind, image.id, image.object_path))
          }}>Remove</Button>}</div></figure>)}</div> : !query.error && <Empty>No photographs uploaded yet.</Empty>}
    {canUpload && <form onSubmit={submit} className="stack upload-form"><h3><ImagePlus size={18} />Add a photograph</h3>
      <Field label="Image" hint="JPEG, PNG, or WebP. Maximum 8 MiB."><input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
      <Field label="Caption"><input maxLength={500} value={caption} onChange={e => setCaption(e.target.value)} /></Field>
      <div className="actions"><Button type="submit" disabled={action.pending || !file}>Upload photograph</Button><Button variant="ghost" disabled={action.pending} onClick={() => action.run(retryImageCleanup)}>Retry cleanup</Button></div>
    </form>}
  </section>
}
