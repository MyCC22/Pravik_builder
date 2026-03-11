'use client'

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
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200">
        {/* Left panel — Branding */}
        <div className={`${theme.accentBg} lg:w-[45%] p-8 lg:p-10 flex flex-col justify-center`}>
          <p className={`text-sm font-medium ${theme.accentText} opacity-80 uppercase tracking-wider mb-3`}>
            {siteName}
          </p>
          <h1 className={`text-2xl lg:text-3xl font-bold ${theme.accentText} tracking-tight mb-3`}>
            {config.title}
          </h1>
          <p className={`text-sm lg:text-base ${theme.accentText} opacity-80 leading-relaxed mb-8`}>
            {config.subtitle}
          </p>

          {config.trustSignals.length > 0 && (
            <ul className="space-y-3">
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
        <div className="lg:w-[55%] bg-white p-8 lg:p-10">
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
  )
}
