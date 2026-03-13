'use client'

interface Project {
  id: string
  name: string
  source: string | null
  created_at: string
  updated_at: string
}

interface VoiceProjectCardProps {
  project: Project
  isActive: boolean
  isNavigating: boolean
  timeAgo: string
  onClick: () => void
  index: number
}

export function VoiceProjectCard({
  project,
  isActive,
  isNavigating,
  timeAgo,
  onClick,
  index,
}: VoiceProjectCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={isNavigating}
      className={`
        w-full text-left rounded-2xl overflow-hidden transition-all duration-200
        active:scale-[0.98] disabled:pointer-events-none
        ${isActive
          ? 'bg-white/[0.06] ring-1 ring-emerald-500/40'
          : 'bg-white/[0.03] hover:bg-white/[0.05]'
        }
      `}
      style={{
        animationDelay: `${index * 60}ms`,
        animation: 'fadeSlideIn 0.4s ease-out both',
      }}
    >
      {/* Preview thumbnail */}
      <div className="relative w-full aspect-[16/9] bg-white/[0.02] overflow-hidden">
        <iframe
          src={`/api/builder/preview/${project.id}?t=${new Date(project.updated_at).getTime()}`}
          className="absolute inset-0 w-[400%] h-[400%] origin-top-left pointer-events-none border-0"
          style={{ transform: 'scale(0.25)' }}
          tabIndex={-1}
          loading="lazy"
          sandbox="allow-same-origin"
        />
        {/* Overlay gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Active badge */}
        {isActive && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-medium text-emerald-300">
              Active
            </span>
          </div>
        )}

        {/* Loading overlay */}
        {isNavigating && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white/70 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.2"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-medium text-white/85 truncate">
              {project.name || 'Untitled Website'}
            </h3>
            <p className="text-[12px] text-white/30 mt-0.5">
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
            className="text-white/20 flex-shrink-0 mt-0.5"
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
