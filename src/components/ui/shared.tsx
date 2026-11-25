import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { Button } from './button'
import { message } from '../../lib/utils'
import { PAGE_SIZE } from '../../services/api'

export function ErrorBox({ error }: { error: unknown }) {
  return error ? <div className="alert error" role="alert"><AlertCircle size={18} /><span>{message(error)}</span></div> : null
}
export function Feedback({ action }: { action: { error: string; notice: string } }) {
  return <><ErrorBox error={action.error} />{action.notice && <p className="notice" role="status">{action.notice}</p>}</>
}
export function Loading() { return <p className="loading" role="status"><LoaderCircle className="spin" size={20} /> Consulting the archives…</p> }
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div> }
export function Badge({ children }: { children: ReactNode }) { return <span className={`badge badge-${String(children).toLowerCase()}`}>{children}</span> }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
export function PageHeader({ eyebrow, title, children, action }: { eyebrow?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow || 'CAMPAIGN ARCHIVES'}</p><h1>{title}</h1>{children && <div className="muted">{children}</div>}</div>{action && <div className="header-action">{action}</div>}</header>
}
export function RequireLogin({ children, user }: { children: ReactNode; user: unknown }) {
  return user ? children : <Empty><h2>Authentication required</h2><p>Sign in to make changes. Published campaign records remain open to everyone.</p><Button asChild><Link to="/auth">Sign in</Link></Button></Empty>
}
export function Pagination({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  return <nav className="pagination" aria-label="Pagination"><Button variant="outline" disabled={!page} onClick={() => onPage(page - 1)}><ChevronLeft size={16} />Previous</Button><span>Page {page + 1}</span><Button variant="outline" disabled={count < PAGE_SIZE} onClick={() => onPage(page + 1)}>Next<ChevronRight size={16} /></Button></nav>
}
