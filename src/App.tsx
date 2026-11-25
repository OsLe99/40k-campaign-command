import { Component, useEffect, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Flag, LogOut, Shield, Swords, Users } from 'lucide-react'
import { configured, configurationError, db } from './lib/supabase'
import { api } from './services/api'
import { useAuth } from './contexts/AuthContext'
import { useAction } from './hooks/useAction'
import { Button } from './components/ui/button'
import { Empty, ErrorBox, Feedback, Loading } from './components/ui/shared'
import { CampaignsPage, NewCampaignPage } from './pages/CampaignsPage'
import { CampaignPage } from './pages/CampaignPage'
import { ManageCampaignPage } from './pages/ManageCampaignPage'
import { ArmiesPage, ArmyFormPage, ArmyPage } from './pages/ArmiesPage'
import { PlayersPage, PlayerPage, AccountPage, AdminPage } from './pages/PlayersPage'
import { AuthPage } from './pages/AuthPage'
import { BattlePage, NewBattlePage } from './pages/BattlePages'

export function SetupScreen() {
  return <section className="setup panel"><p className="eyebrow">AWAITING CONNECTION</p><Shield size={52} strokeWidth={1} /><h1>Establish your command link</h1>
    <p>The application is installed, but Supabase has not been configured. No campaign records are being simulated.</p>
    {configurationError && <p className="alert" role="status">{configurationError}</p>}
    <ol><li>Start the local Supabase stack or prepare your hosted project using the README.</li><li>Apply the version-controlled database migrations.</li><li>Copy <code>.env.example</code> to <code>.env.local</code> and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</li><li>Restart the development server.</li></ol>
    <p className="muted">Use only the publishable or legacy anon key. Never put service-role credentials in browser configuration.</p>
  </section>
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Empty><h1>Unable to load command</h1><p>Please reload the application. If the problem persists, verify your configuration.</p><Button onClick={() => window.location.reload()}>Reload</Button></Empty> : this.props.children }
}
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
function Shell() {
  const { user, loading, error } = useAuth()
  const action = useAction()
  const admins = useQuery({ queryKey: ['admins', user?.id], queryFn: api.admins, enabled: configured && !!user })
  return <><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <Link className="brand" to="/"><Shield size={34} strokeWidth={1.3} /><span>CAMPAIGN<span className="brand-sub">COMMAND / 40K</span></span></Link>
      <nav className="main-nav" aria-label="Main navigation"><NavLink to="/" end><Flag size={15} />Campaigns</NavLink><NavLink to="/armies"><Swords size={15} />Armies</NavLink><NavLink to="/players"><Users size={15} />Players</NavLink></nav>
      <div className="user-nav">{user ? <><NavLink to="/account">Command desk</NavLink>{admins.data?.some(a => a.player_id === user.id) && <NavLink to="/admin">Admin</NavLink>}<Button variant="ghost" disabled={action.pending} aria-label="Sign out" onClick={() => action.run(async () => { const r = await db().auth.signOut(); if (r.error) throw r.error })}><LogOut size={17} /></Button></> : configured && <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>}</div>
    </div></header><main id="main-content" tabIndex={-1} className="container"><ScrollToTop /><Feedback action={action} /><ErrorBox error={error} />
      {!configured ? <SetupScreen /> : loading ? <Loading /> : <Routes>
        <Route path="/" element={<CampaignsPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/campaigns/new" element={<NewCampaignPage />} />
        <Route path="/campaigns/:id" element={<CampaignPage />} />
        <Route path="/campaigns/:id/manage" element={<ManageCampaignPage />} />
        <Route path="/campaigns/:id/battle/new" element={<NewBattlePage />} />
        <Route path="/battles/:id" element={<BattlePage />} />
        <Route path="/armies" element={<ArmiesPage />} />
        <Route path="/armies/new" element={<ArmyFormPage />} />
        <Route path="/armies/:id" element={<ArmyPage />} />
        <Route path="/armies/:id/edit" element={<ArmyFormPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/:id" element={<PlayerPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Empty><h1>Sector not found</h1><Link to="/">Return to campaign archives</Link></Empty>} />
      </Routes>}
    </main><footer className="site-footer"><span>CAMPAIGN COMMAND <span className="muted">/</span> NARRATIVE ARCHIVES</span><p>Unofficial fan project. Not affiliated with Games Workshop.</p></footer>
  </>
}
export default function App() { return <ErrorBoundary><Shell /></ErrorBoundary> }
