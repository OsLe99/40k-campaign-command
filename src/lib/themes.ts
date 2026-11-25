export const THEME_IDS = ['imperium', 'chaos', 'orks', 'necrons', 'tau', 'aeldari', 'tyranids', 'drukhari', 'votann', 'genestealer-cults'] as const
export type ThemeId = typeof THEME_IDS[number]
export const DEFAULT_THEME: ThemeId = 'imperium'

type Palette = {
  background: string; surface: string; raised: string; foreground: string; muted: string
  primary: string; onPrimary: string; primaryHover: string; accent: string
  border: string; strongBorder: string; input: string
}
type ThemeDefinition = {
  id: ThemeId; label: string; identity: string; scheme: 'light' | 'dark'; palette: Palette
  heading: string; radius: string; controlRadius: string; decoration: string; texture: string; shadow: string
}
const serif = 'Georgia, "Times New Roman", serif'
const sans = '"Segoe UI", system-ui, sans-serif'
const mono = 'Consolas, "Courier New", monospace'

// Original gradients/patterns only: no official art, logos, external fonts, or assets.
const definitions: ThemeDefinition[] = [
  {
    id: 'imperium', label: 'Imperium of Man', identity: 'Gothic crimson, antique gold, and parchment.', scheme: 'dark',
    palette: { background: '#171013', surface: '#251a1b', raised: '#35272a', foreground: '#f4ead4', muted: '#c4b79f', primary: '#dfc07b', onPrimary: '#24170e', primaryHover: '#f2dba3', accent: '#d88b8e', border: '#66514a', strongBorder: '#94796b', input: '#1d1518' },
    heading: serif, radius: '3px', controlRadius: '3px',
    decoration: 'repeating-linear-gradient(90deg, transparent 0 38px, color-mix(in srgb, var(--primary) 9%, transparent) 38px 40px, transparent 40px 48px)',
    texture: 'radial-gradient(ellipse at 50% 0%, #52242b55, transparent 65%)',
    shadow: 'inset 0 2px 0 color-mix(in srgb, var(--primary) 35%, transparent)',
  },
  {
    id: 'chaos', label: 'Chaos', identity: 'Blackened metal, dark red, and scorched brass.', scheme: 'dark',
    palette: { background: '#100d10', surface: '#20171a', raised: '#332026', foreground: '#f2e3d7', muted: '#c9afa0', primary: '#d4aa6a', onPrimary: '#21130c', primaryHover: '#edc995', accent: '#df7d80', border: '#68504d', strongBorder: '#a07865', input: '#160e12' },
    heading: serif, radius: '2px', controlRadius: '2px',
    decoration: 'repeating-linear-gradient(125deg, transparent 0 23px, color-mix(in srgb, var(--accent) 13%, transparent) 24px 26px, transparent 27px 48px)',
    texture: 'radial-gradient(ellipse at 90% 0%, #601e2855, transparent 60%)',
    shadow: 'inset 3px 0 0 color-mix(in srgb, var(--accent) 45%, transparent)',
  },
  {
    id: 'orks', label: 'Orks', identity: 'Scrap-built green, rusty metal, and bold yellow.', scheme: 'dark',
    palette: { background: '#12170e', surface: '#202819', raised: '#313a20', foreground: '#f0eed0', muted: '#c3c5a2', primary: '#ddce56', onPrimary: '#232708', primaryHover: '#f4e88c', accent: '#99d55d', border: '#646b44', strongBorder: '#90975e', input: '#161e11' },
    heading: '"Arial Black", Impact, sans-serif', radius: '1px', controlRadius: '1px',
    decoration: 'repeating-linear-gradient(135deg, transparent 0 16px, color-mix(in srgb, var(--primary) 15%, transparent) 16px 27px, transparent 27px 32px)',
    texture: 'radial-gradient(circle at 5px 5px, #bd7d4b22 2px, transparent 3px) 0 0 / 36px 36px',
    shadow: 'inset 0 -3px 0 color-mix(in srgb, var(--primary) 25%, transparent)',
  },
  {
    id: 'necrons', label: 'Necrons', identity: 'Obsidian and metallic panels with luminous green.', scheme: 'dark',
    palette: { background: '#090f0e', surface: '#13201c', raised: '#20332b', foreground: '#e0f4e8', muted: '#a5c5b3', primary: '#9ee568', onPrimary: '#10230d', primaryHover: '#c0ff90', accent: '#72d7b9', border: '#426052', strongBorder: '#749783', input: '#0c1712' },
    heading: mono, radius: '0px', controlRadius: '0px',
    decoration: 'repeating-linear-gradient(90deg, transparent 0 34px, color-mix(in srgb, var(--primary) 15%, transparent) 34px 35px, transparent 35px 68px)',
    texture: 'linear-gradient(115deg, transparent 45%, #79b69a0a 50%, transparent 55%)',
    shadow: 'inset 0 1px 0 var(--border-strong), 0 0 18px color-mix(in srgb, var(--primary) 7%, transparent)',
  },
  {
    id: 'tau', label: "T'au Empire", identity: 'Clean white panels, precision blue, and orange accents.', scheme: 'light',
    palette: { background: '#eaf0f5', surface: '#ffffff', raised: '#dde8f0', foreground: '#172e44', muted: '#485f73', primary: '#185d8a', onPrimary: '#ffffff', primaryHover: '#10486d', accent: '#a64713', border: '#8095a7', strongBorder: '#5b7489', input: '#f5f9fc' },
    heading: sans, radius: '8px', controlRadius: '6px',
    decoration: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 14%, transparent) 4px, transparent 4px), repeating-linear-gradient(0deg, transparent 0 30px, color-mix(in srgb, var(--primary) 7%, transparent) 30px 31px)',
    texture: 'linear-gradient(135deg, #185d8a08, transparent 60%)',
    shadow: '0 3px 12px #16354c0b',
  },
  {
    id: 'aeldari', label: 'Aeldari', identity: 'Elegant pale surfaces and luminous blue detailing.', scheme: 'light',
    palette: { background: '#eff1f6', surface: '#fcfcff', raised: '#e3e8f4', foreground: '#242b47', muted: '#535e7d', primary: '#285ba0', onPrimary: '#ffffff', primaryHover: '#1e4780', accent: '#6c4d94', border: '#8b96b4', strongBorder: '#66749a', input: '#f7f8ff' },
    heading: serif, radius: '20px', controlRadius: '10px',
    decoration: 'repeating-radial-gradient(ellipse at 100% 100%, transparent 0 20px, color-mix(in srgb, var(--primary) 10%, transparent) 21px 22px, transparent 23px 42px)',
    texture: 'radial-gradient(ellipse at 80% 0%, #709be522, transparent 65%)',
    shadow: '0 4px 20px #28477b0d',
  },
  {
    id: 'tyranids', label: 'Tyranids', identity: 'Organic purple chitin, bone, and dark red.', scheme: 'dark',
    palette: { background: '#1c101d', surface: '#2b1a2d', raised: '#41243f', foreground: '#efe7cc', muted: '#c7b4c5', primary: '#e0cfa0', onPrimary: '#281b26', primaryHover: '#f4e5b9', accent: '#d789b4', border: '#79536d', strongBorder: '#a47e97', input: '#201323' },
    heading: serif, radius: '24px', controlRadius: '12px',
    decoration: 'repeating-radial-gradient(ellipse at 10% 100%, transparent 0 20px, color-mix(in srgb, var(--accent) 14%, transparent) 22px 26px, transparent 28px 48px)',
    texture: 'radial-gradient(ellipse at 0% 0%, #712e4855, transparent 65%)',
    shadow: 'inset 0 3px 0 color-mix(in srgb, var(--primary) 20%, transparent)',
  },
  {
    id: 'drukhari', label: 'Drukhari', identity: 'Black and dark purple with sinister neon accents.', scheme: 'dark',
    palette: { background: '#0f0a17', surface: '#1e142b', raised: '#30203f', foreground: '#f0e4fa', muted: '#c7b0d9', primary: '#c6ef91', onPrimary: '#1b2510', primaryHover: '#dbffb3', accent: '#df93f1', border: '#6a4b7e', strongBorder: '#a078b8', input: '#140d1e' },
    heading: serif, radius: '0px', controlRadius: '0px',
    decoration: 'repeating-linear-gradient(155deg, transparent 0 28px, color-mix(in srgb, var(--accent) 18%, transparent) 29px 30px, transparent 31px 62px)',
    texture: 'radial-gradient(ellipse at 100% 10%, #63267533, transparent 60%)',
    shadow: 'inset -2px 0 0 var(--accent), 0 0 16px color-mix(in srgb, var(--accent) 8%, transparent)',
  },
  {
    id: 'votann', label: 'Leagues of Votann', identity: 'Rugged industrial orange, grey, and machined panels.', scheme: 'dark',
    palette: { background: '#15191c', surface: '#23292e', raised: '#343d43', foreground: '#f1e9dd', muted: '#bfc4c7', primary: '#efae68', onPrimary: '#2b1c0c', primaryHover: '#ffd09b', accent: '#8bc5d7', border: '#65727b', strongBorder: '#94a2ad', input: '#191f24' },
    heading: '"Trebuchet MS", "Segoe UI", sans-serif', radius: '6px', controlRadius: '4px',
    decoration: 'radial-gradient(circle at 8px 8px, color-mix(in srgb, var(--primary) 25%, transparent) 2px, transparent 3px) 0 0 / 44px 44px',
    texture: 'repeating-linear-gradient(0deg, transparent 0 3px, #91a4b009 3px 4px)',
    shadow: 'inset 0 3px 0 var(--border-strong)',
  },
  {
    id: 'genestealer-cults', label: 'Genestealer Cults', identity: 'Mining-industrial purple with hazard markings.', scheme: 'dark',
    palette: { background: '#15121d', surface: '#24202f', raised: '#352d41', foreground: '#f0e8dd', muted: '#c5b8cf', primary: '#e1c56d', onPrimary: '#29200f', primaryHover: '#f9dfa0', accent: '#c998e3', border: '#71617f', strongBorder: '#a18baf', input: '#1b1725' },
    heading: mono, radius: '2px', controlRadius: '2px',
    decoration: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent) 0 10px, transparent 10px 20px)',
    texture: 'repeating-linear-gradient(90deg, transparent 0 47px, #c998e308 47px 48px)',
    shadow: 'inset 0 -3px 0 color-mix(in srgb, var(--primary) 35%, transparent)',
  },
]

function tokens(definition: ThemeDefinition): Record<`--${string}`, string> {
  const p = definition.palette
  const light = definition.scheme === 'light'
  return {
    '--background': p.background, '--foreground': p.foreground, '--surface': p.surface,
    '--surface-raised': p.raised, '--primary': p.primary, '--primary-foreground': p.onPrimary,
    '--primary-hover': p.primaryHover, '--accent': p.accent, '--border': p.border,
    '--border-strong': p.strongBorder, '--input': p.input, '--muted': p.muted,
    '--body-font': sans, '--heading-font': definition.heading, '--radius': definition.radius,
    '--control-radius': definition.controlRadius, '--panel-shadow': definition.shadow,
    '--decoration': definition.decoration, '--body-texture': definition.texture,
    '--hero-background': 'radial-gradient(ellipse at 85% 70%, color-mix(in srgb, var(--accent) 22%, var(--surface)), var(--surface) 70%)',
    '--art-background': 'radial-gradient(ellipse at 50% 100%, color-mix(in srgb, var(--accent) 28%, var(--surface)), var(--surface-raised) 80%)',
    '--success-foreground': light ? '#214b25' : '#c4e7ad', '--success-background': light ? '#e2efdf' : '#243a22',
    '--warning-foreground': light ? '#694000' : '#ffe0a3', '--warning-background': light ? '#fff0ce' : '#3c2d16',
    '--danger-foreground': light ? '#862020' : '#ffc7c2', '--danger-background': light ? '#ffe5e0' : '#492027',
  }
}

export const THEMES = definitions.map(definition => ({ ...definition, tokens: tokens(definition) }))
export type Theme = typeof THEMES[number]
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_IDS.some(id => id === value)
}
export function getTheme(value: unknown): Theme {
  return THEMES.find(theme => theme.id === value) || THEMES[0]
}
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.scheme
  for (const [token, value] of Object.entries(theme.tokens)) root.style.setProperty(token, value)
}
