'use client'

import { useState, useEffect } from 'react'

const STEPS = [
  'Choosing the perfect template...',
  'Writing your content...',
  'Finding hero images...',
  'Assembling your website...',
]

export function GeneratingAnimation() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-center h-full bg-black">
      <div className="flex flex-col items-center gap-8">
        {/* Wireframe */}
        <div className="max-w-[180px] w-full flex flex-col gap-1.5">
          {/* Nav bar */}
          <div
            className="h-3 bg-[#333] rounded-sm opacity-0"
            style={{
              animation: 'fadeInUp 0.5s ease-out forwards, wfSlide 2s ease-in-out 0.5s infinite',
            }}
          />
          {/* Hero block */}
          <div
            className="h-12 rounded bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 opacity-0"
            style={{
              animation: 'fadeInUp 0.5s ease-out 0.4s forwards, wfPulse 2.5s ease-in-out 0.9s infinite',
            }}
          />
          {/* Three columns */}
          <div className="flex gap-1">
            {[0.8, 1.0, 1.2].map((delay, i) => (
              <div
                key={i}
                className="flex-1 h-7 bg-[#1a1a1a] rounded-sm border border-[#333] opacity-0"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${delay}s forwards, wfFade 2s ease-in-out ${delay + 0.5}s infinite`,
                }}
              />
            ))}
          </div>
          {/* Footer */}
          <div
            className="h-2.5 bg-[#222] rounded-sm opacity-0"
            style={{
              animation: 'fadeInUp 0.5s ease-out 1.6s forwards, wfSlide 2s ease-in-out 2.1s infinite',
            }}
          />
        </div>

        {/* Progress text + dots */}
        <div className="text-center">
          <p
            className="text-[13px] text-gray-400 transition-opacity duration-300 min-h-[20px]"
            key={currentStep}
          >
            {STEPS[currentStep]}
          </p>
          <div className="flex gap-1.5 justify-center mt-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  i === currentStep
                    ? 'bg-emerald-500'
                    : i < currentStep
                      ? 'bg-emerald-500/40'
                      : 'bg-[#333]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wfSlide {
          0%, 100% { transform: scaleX(0.6); opacity: 0.4; }
          50% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes wfPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes wfFade {
          0%, 100% { opacity: 0.2; transform: scaleY(0.5); }
          50% { opacity: 0.8; transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
