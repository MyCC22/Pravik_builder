import type { ThemeId } from './types'

export interface ThemeColors {
  bg: string
  text: string
  accent: string
  accentHover: string
  accentText: string
  surface: string
  muted: string
  border: string
}

export const themes: Record<ThemeId, ThemeColors> = {
  clean: {
    bg: '#ffffff',
    text: '#0f172a',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    accentText: '#ffffff',
    surface: '#f8fafc',
    muted: '#64748b',
    border: '#e2e8f0',
  },
  bold: {
    bg: '#09090b',
    text: '#fafafa',
    accent: '#6366f1',
    accentHover: '#818cf8',
    accentText: '#ffffff',
    surface: '#18181b',
    muted: '#a1a1aa',
    border: '#27272a',
  },
  vibrant: {
    bg: '#eff6ff',
    text: '#1e293b',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentText: '#ffffff',
    surface: 'rgba(255,255,255,0.7)',
    muted: '#64748b',
    border: 'rgba(148,163,184,0.2)',
  },
  warm: {
    bg: '#faf8f5',
    text: '#1c1210',
    accent: '#c2410c',
    accentHover: '#9a3412',
    accentText: '#ffffff',
    surface: '#f5f0ea',
    muted: '#78716c',
    border: '#e7e0d8',
  },
}

// Map legacy theme IDs for backward compatibility
const LEGACY_MAP: Record<string, ThemeId> = {
  ocean: 'bold',
  sunset: 'warm',
  violet: 'bold',
  forest: 'clean',
  mono: 'clean',
}

export function resolveThemeId(id: string): ThemeId {
  if (id in themes) return id as ThemeId
  if (id in LEGACY_MAP) return LEGACY_MAP[id]
  return 'clean'
}

export function getThemeCSS(themeId: string): string {
  const resolved = resolveThemeId(themeId)
  const t = themes[resolved]

  const bgRule = resolved === 'vibrant'
    ? 'background: linear-gradient(160deg, #dbeafe 0%, #ede9fe 25%, #e0f2fe 50%, #f0fdf4 75%, #fdf4ff 100%); background-attachment: fixed;'
    : `background: ${t.bg};`

  const navBg = resolved === 'vibrant'
    ? 'rgba(239,246,255,0.75)'
    : resolved === 'bold'
      ? 'rgba(9,9,11,0.8)'
      : `${t.bg}f2`

  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    :root {
      --bg: ${t.bg};
      --text: ${t.text};
      --accent: ${t.accent};
      --accent-hover: ${t.accentHover};
      --accent-text: ${t.accentText};
      --surface: ${t.surface};
      --muted: ${t.muted};
      --border: ${t.border};
    }

    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      ${bgRule}
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      font-size: 16px;
      min-height: 100vh;
    }

    h1, h2, h3, h4, h5, h6 {
      color: var(--text);
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: -0.025em;
    }

    p { color: var(--muted); line-height: 1.75; }

    a {
      color: var(--accent);
      text-decoration: none;
      transition: color 0.15s ease;
    }
    a:hover { color: var(--accent-hover); }

    img { max-width: 100%; height: auto; display: block; }

    nav {
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      background: ${navBg};
      border-bottom: 1px solid var(--border);
    }

    section { padding: 6rem 1.5rem; }
    @media (min-width: 640px) { section { padding: 7rem 2rem; } }

    footer {
      border-top: 1px solid var(--border);
      padding: 3rem 1.5rem;
    }
  `
}
