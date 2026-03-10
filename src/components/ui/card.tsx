import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white/5 border border-white/10 rounded-2xl p-5 ${
          hoverable ? 'hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'
