import { useTheme } from '../contexts/ThemeContext'
import { isThemeId, THEMES } from '../lib/themes'
import { Button } from './ui/button'
import { ErrorBox, Field } from './ui/shared'

export function ThemeSettings() {
  const { theme, loading, pending, canSave, error, notice, selectTheme, retry } = useTheme()
  return <section className="panel theme-settings" aria-labelledby="theme-settings-title">
    <p className="eyebrow">PERSONAL APPEARANCE</p><h2 id="theme-settings-title">Faction theme</h2>
    <p id="theme-personal-note" className="muted">Only changes your view of this website. Campaigns, armies, battles, and other users are never affected.</p>
    <Field label="Your faction theme">
      <select aria-describedby="theme-personal-note theme-identity" value={theme.id} disabled={loading || pending || !canSave} onChange={event => {
        if (isThemeId(event.target.value)) void selectTheme(event.target.value)
      }}>{THEMES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
    </Field>
    <div className="theme-swatches" aria-hidden="true">{['background', 'surface', 'primary', 'accent', 'foreground'].map(token =>
      <span key={token} style={{ background: `var(--${token})` }} />)}</div>
    <p id="theme-identity">{theme.identity}</p>
    <ErrorBox error={error} />
    {error && !canSave && <Button variant="outline" onClick={retry}>Retry preference</Button>}
    <p className="muted" role="status" aria-live="polite">{loading ? 'Loading your preference…' : pending ? 'Saving your personal theme…' : notice || 'Changes are saved to your profile automatically.'}</p>
  </section>
}
