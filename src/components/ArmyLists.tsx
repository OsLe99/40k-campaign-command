import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAction } from '../hooks/useAction'
import { ARMY_LIST_ACCEPT, fileSize, validateArmyList } from '../lib/armyLists'
import { message } from '../lib/utils'
import { armyLists, armyListDownload, removeArmyList, retryArmyListCleanup, uploadArmyList } from '../services/armyLists'
import { Button } from './ui/button'
import { Empty, ErrorBox, Feedback, Field, Loading } from './ui/shared'

export function ArmyLists({ armyId, canUpload, canModerate = false }: { armyId: string; canUpload: boolean; canModerate?: boolean }) {
  const { user } = useAuth()
  const action = useAction()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [label, setLabel] = useState('')
  const query = useQuery({ queryKey: ['army-lists', armyId], queryFn: () => armyLists(armyId) })
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || !user || !canUpload || action.pending) return
    const form = event.currentTarget
    await action.run(() => uploadArmyList(armyId, user.id, file, label), () => { setFile(null); setLabel(''); form.reset() })
    await query.refetch()
  }
  return <section className="panel"><h2>Army lists</h2>
    <p className="muted">Exported rosters attached to this army. Files are downloaded as-is, not imported into the campaign.</p>
    <Feedback action={action} /><ErrorBox error={query.error} />
    {query.isPending ? <Loading /> : query.data?.length ? <ul className="attachment-list">
      {query.data.map(list => <li className="list-row wrap" key={list.id}>
        <div className="attachment-details"><h3>{list.label || list.file_name}</h3>
          {list.label && <p>{list.file_name}</p>}
          <small>{fileSize(list.file_size)} · {new Date(list.uploaded_at).toLocaleDateString()}</small>
        </div>
        <div className="actions"><Button variant="outline" disabled={action.pending} aria-label={`Download ${list.label || list.file_name}`} onClick={() => action.run(async () => {
          const url = await armyListDownload(list)
          const link = document.createElement('a')
          link.href = url
          link.rel = 'noopener noreferrer'
          link.download = list.file_name
          document.body.append(link)
          link.click()
          link.remove()
        })}><Download size={16} />Download</Button>
          {(canModerate || (canUpload && list.uploaded_by === user?.id)) && <Button variant="destructive" disabled={action.pending} aria-label={`Remove ${list.label || list.file_name}`} onClick={async () => {
            if (window.confirm(`Remove "${list.label || list.file_name}" permanently?`)) {
              await action.run(() => removeArmyList(list))
              await query.refetch()
            }
          }}>Remove</Button>}</div>
      </li>)}
    </ul> : !query.error && <Empty>No army lists attached yet.</Empty>}
    {canUpload && <form className="stack upload-form" onSubmit={submit}>
      <h3><FileUp size={18} />Attach an army list</h3>
      <p className="notice">Anyone viewing this public army page can download attached files. Do not upload private information.</p>
      <Field label="Army list file" hint="NewRecruit or another builder: JSON, ROS, ROSZ, TXT, or PDF. Maximum 8 MiB.">
        <input type="file" required accept={ARMY_LIST_ACCEPT} disabled={action.pending} onChange={event => {
          setFile(null); setFileError('')
          const selected = event.target.files?.[0]
          if (!selected) return
          try { validateArmyList(selected); setFile(selected) } catch (error) { setFileError(message(error)) }
        }} />
      </Field>
      <ErrorBox error={fileError} />
      <Field label="List label (optional)" hint="For example: 2,000 points — November roster. New uploads do not replace older lists.">
        <input maxLength={120} value={label} disabled={action.pending} onChange={event => setLabel(event.target.value)} />
      </Field>
      <div className="actions"><Button type="submit" disabled={action.pending || !file}>{action.pending ? 'Working…' : 'Attach list'}</Button>
        <Button variant="ghost" disabled={action.pending} onClick={() => user && action.run(() => retryArmyListCleanup(user.id, armyId))}>Retry list cleanup</Button>
      </div>
    </form>}
  </section>
}
