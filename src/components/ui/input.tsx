import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-colors ${error ? 'border-red-500' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
