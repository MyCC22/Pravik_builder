import type { ThemeId } from './types'

export interface ThemeClasses {
  bg: string
  text: string
  textMuted: string
  accent: string
  accentHover: string
  accentBg: string
  accentBgHover: string
  accentText: string
  surface: string
  border: string
  borderColor: string
  navBg: string
  sectionAlt: string
}

const themeClassMap: Record<ThemeId, ThemeClasses> = {
  clean: {
    bg: 'bg-white',
    text: 'text-slate-900',
    textMuted: 'text-slate-500',
    accent: 'text-blue-600',
    accentHover: 'hover:text-blue-700',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-700',
    accentText: 'text-white',
    surface: 'bg-slate-50',
    border: 'ring-1 ring-slate-200',
    borderColor: 'border-slate-200',
    navBg: 'bg-white/80 backdrop-blur-xl',
    sectionAlt: 'bg-slate-50',
  },
  bold: {
    bg: 'bg-zinc-950',
    text: 'text-white',
    textMuted: 'text-zinc-400',
    accent: 'text-indigo-400',
    accentHover: 'hover:text-indigo-300',
    accentBg: 'bg-indigo-500',
    accentBgHover: 'hover:bg-indigo-400',
    accentText: 'text-white',
    surface: 'bg-zinc-900',
    border: 'ring-1 ring-zinc-800',
    borderColor: 'border-zinc-800',
    navBg: 'bg-zinc-950/80 backdrop-blur-xl',
    sectionAlt: 'bg-zinc-900',
  },
  vibrant: {
    bg: 'bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    accent: 'text-blue-600',
    accentHover: 'hover:text-blue-700',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-700',
    accentText: 'text-white',
    surface: 'bg-white/70 backdrop-blur-sm',
    border: 'ring-1 ring-slate-200/60',
    borderColor: 'border-slate-200/60',
    navBg: 'bg-white/60 backdrop-blur-xl',
    sectionAlt: 'bg-white/40',
  },
  warm: {
    bg: 'bg-stone-50',
    text: 'text-stone-900',
    textMuted: 'text-stone-500',
    accent: 'text-orange-700',
    accentHover: 'hover:text-orange-800',
    accentBg: 'bg-orange-700',
    accentBgHover: 'hover:bg-orange-800',
    accentText: 'text-white',
    surface: 'bg-white',
    border: 'ring-1 ring-stone-200',
    borderColor: 'border-stone-200',
    navBg: 'bg-stone-50/80 backdrop-blur-xl',
    sectionAlt: 'bg-stone-100/50',
  },
}

export function getThemeClasses(themeId: ThemeId): ThemeClasses {
  return themeClassMap[themeId] || themeClassMap.clean
}
