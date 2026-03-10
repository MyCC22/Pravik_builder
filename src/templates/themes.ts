import type { ThemeId } from './types'

export interface ThemeColors {
  bg: string
  text: string
  accent: string
  accentText: string
  surface: string
  muted: string
  border: string
}

export const themes: Record<ThemeId, ThemeColors> = {
  ocean: {
    bg: '#0f172a',
    text: '#f8fafc',
    accent: '#3b82f6',
    accentText: '#ffffff',
    surface: 'rgba(255,255,255,0.05)',
    muted: '#94a3b8',
    border: 'rgba(255,255,255,0.1)',
  },
  sunset: {
    bg: '#fefce8',
    text: '#1c1917',
    accent: '#f97316',
    accentText: '#ffffff',
    surface: 'rgba(249,115,22,0.05)',
    muted: '#78716c',
    border: 'rgba(0,0,0,0.1)',
  },
  violet: {
    bg: '#0c0a1a',
    text: '#f5f3ff',
    accent: '#8b5cf6',
    accentText: '#ffffff',
    surface: 'rgba(139,92,246,0.05)',
    muted: '#a78bfa',
    border: 'rgba(255,255,255,0.1)',
  },
  forest: {
    bg: '#f0fdf4',
    text: '#14532d',
    accent: '#16a34a',
    accentText: '#ffffff',
    surface: 'rgba(22,163,74,0.05)',
    muted: '#6b7280',
    border: 'rgba(0,0,0,0.1)',
  },
  mono: {
    bg: '#fafafa',
    text: '#09090b',
    accent: '#18181b',
    accentText: '#ffffff',
    surface: '#f4f4f5',
    muted: '#71717a',
    border: '#e4e4e7',
  },
}

export function getThemeCSS(themeId: ThemeId): string {
  const t = themes[themeId]
  return `
    :root {
      --bg: ${t.bg};
      --text: ${t.text};
      --accent: ${t.accent};
      --accent-text: ${t.accentText};
      --surface: ${t.surface};
      --muted: ${t.muted};
      --border: ${t.border};
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
    }
    a { color: var(--accent); text-decoration: none; }
  `
}
