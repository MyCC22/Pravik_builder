'use client'

import { useEffect } from 'react'
import type { ToolConfig } from '@/services/agents/types'
import type { ThemeClasses } from '@/templates/theme-classes'
import { BookingForm } from './booking-form'

interface BookingPageProps {
  toolId: string
  config: ToolConfig
  siteName: string
  theme: ThemeClasses
}

export function BookingPage({ toolId, config, siteName, theme }: BookingPageProps) {
  // Break out of iframe if embedded (e.g. from clicking "Book Now" in preview)
  useEffect(() => {
    if (window.self !== window.top) {
      window.top?.location.replace(window.location.href)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Back button */}
      <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to site
          </button>
        </div>
      </div>

      {/* Form card */}
      <div className="flex items-start lg:items-center justify-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-16 min-h-[calc(100vh-49px)]">
        <div className="w-full max-w-4xl flex flex-col lg:flex-row rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200">
          {/* Left panel — Branding (compact on mobile) */}
          <div className={`${theme.accentBg} lg:w-[45%] p-5 sm:p-6 lg:p-10 flex flex-col justify-center`}>
            <p className={`text-xs sm:text-sm font-medium ${theme.accentText} opacity-80 uppercase tracking-wider mb-2 lg:mb-3`}>
              {siteName}
            </p>
            <h1 className={`text-xl sm:text-2xl lg:text-3xl font-bold ${theme.accentText} tracking-tight mb-2 lg:mb-3`}>
              {config.title}
            </h1>
            {/* Subtitle: truncated on mobile, full on desktop */}
            <p className={`text-sm lg:text-base ${theme.accentText} opacity-80 leading-relaxed mb-4 lg:mb-8 line-clamp-2 lg:line-clamp-none`}>
              {config.subtitle}
            </p>

            {/* Trust signals — hidden on mobile, shown on large screens */}
            {config.trustSignals.length > 0 && (
              <ul className="hidden lg:flex flex-col space-y-3">
                {config.trustSignals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg className={`w-5 h-5 ${theme.accentText} opacity-90 mt-0.5 flex-shrink-0`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className={`text-sm ${theme.accentText} opacity-90`}>{signal}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right panel — Form */}
          <div className="lg:w-[55%] bg-white p-5 sm:p-6 lg:p-10">
            <BookingForm
              toolId={toolId}
              config={config}
              siteName={siteName}
              accentBg={theme.accentBg}
              accentBgHover={theme.accentBgHover}
              accentText={theme.accentText}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
