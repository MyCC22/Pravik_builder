'use client'

interface VoiceCallBannerProps {
  callActive: boolean
}

export function VoiceCallBanner({ callActive }: VoiceCallBannerProps) {
  if (!callActive) return null

  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-green-500/20 backdrop-blur-sm rounded-full px-3 py-1.5">
      <span
        className="w-2 h-2 rounded-full bg-green-400"
        style={{
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />
      <span className="text-xs text-green-300 font-medium">
        Voice AI active
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
