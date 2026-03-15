'use client'

interface Project {
  id: string
  name: string
  source: string | null
  created_at: string
  updated_at: string
  template_config?: {
    theme?: string
    content?: {
      siteName?: string
      businessCategory?: string
    }
  } | null
}

interface VoiceProjectCardProps {
  project: Project
  isActive: boolean
  isNavigating: boolean
  timeAgo: string
  onClick: () => void
  index: number
}

const THEME_GRADIENTS: Record<string, string> = {
  clean: 'from-blue-600 to-cyan-500',
  bold: 'from-indigo-600 to-purple-600',
  vibrant: 'from-blue-500 via-purple-500 to-emerald-500',
  warm: 'from-orange-500 to-amber-400',
}

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: '🍽', cafe: '☕', bakery: '🧁', bar: '🍸',
  yoga: '🧘', fitness: '💪', spa: '✨', salon: '💇',
  dental: '🦷', medical: '🏥', veterinary: '🐾',
  plumbing: '🔧', electrician: '⚡', landscaping: '🌿',
  'auto-repair': '🔩', hvac: '❄️', construction: '🏗',
  photography: '📷', music: '🎵', dance: '💃', art: '🎨',
  education: '📚', 'martial-arts': '🥋', tech: '💻',
  'real-estate': '🏠', law: '⚖️', wedding: '💍',
  event: '🎉', catering: '🍴', florist: '🌸', fashion: '👗',
  coaching: '🎯', consulting: '📊', marketing: '📣',
}

export function VoiceProjectCard({
  project,
  isActive,
  isNavigating,
  timeAgo,
  onClick,
  index,
}: VoiceProjectCardProps) {
  const theme = project.template_config?.theme || 'clean'
  const siteName = project.template_config?.content?.siteName
  const category = project.template_config?.content?.businessCategory
  const gradient = THEME_GRADIENTS[theme] || THEME_GRADIENTS.clean
  const categoryIcon = category ? CATEGORY_ICONS[category] || '🌐' : '🌐'

  return (
    <button
      onClick={onClick}
      disabled={isNavigating}
      className={`
        w-full text-left rounded-2xl overflow-hidden transition-all duration-200
        active:scale-[0.98] disabled:pointer-events-none
        ${isActive
          ? 'ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-black'
          : ''
        }
      `}
      style={{
        animationDelay: `${index * 60}ms`,
        animation: 'fadeSlideIn 0.4s ease-out both',
      }}
    >
      {/* Gradient header strip */}
      <div className={`relative h-20 bg-gradient-to-r ${gradient} overflow-hidden`}>
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
        {/* Category icon */}
        <div className="absolute top-3 right-3 text-2xl opacity-60 drop-shadow-sm">
          {categoryIcon}
        </div>
        {/* Active badge */}
        {isActive && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-white/90">Active</span>
          </div>
        )}
        {/* Loading overlay */}
        {isNavigating && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <svg className="w-6 h-6 text-white/80 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="bg-white/[0.04] p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-white/90 truncate">
              {siteName || project.name || 'Untitled Website'}
            </h3>
            {siteName && project.name && siteName !== project.name && (
              <p className="text-[11px] text-white/30 mt-0.5 truncate">
                {project.name}
              </p>
            )}
            <p className="text-[11px] text-white/25 mt-1">
              {timeAgo}
            </p>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-white/20 flex-shrink-0 mt-1"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </button>
  )
}
