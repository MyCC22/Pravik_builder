'use client'

interface ThankYouProps {
  message: string
  siteName: string
}

export function ThankYou({ message, siteName }: ThankYouProps) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Submitted!</h2>
      <p className="text-slate-600 text-base leading-relaxed max-w-md mx-auto">{message}</p>
      <p className="text-slate-400 text-sm mt-6">— {siteName}</p>
    </div>
  )
}
