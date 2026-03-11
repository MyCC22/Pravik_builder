'use client'

import { useState, FormEvent } from 'react'
import type { ToolConfig } from '@/services/agents/types'
import { FormField } from './form-fields'
import { ThankYou } from './thank-you'

interface BookingFormProps {
  toolId: string
  config: ToolConfig
  siteName: string
  accentBg: string
  accentBgHover: string
  accentText: string
}

function validateField(value: string, field: ToolConfig['fields'][0]): string | null {
  if (field.required && !value.trim()) {
    return `${field.label} is required`
  }
  if (!value.trim()) return null

  switch (field.type) {
    case 'email':
      if (!/^.+@.+\..+$/.test(value)) return 'Please enter a valid email address'
      break
    case 'phone': {
      const digits = value.replace(/\D/g, '')
      if (digits.length < 7) return 'Please enter a valid phone number'
      break
    }
    case 'number':
      if (isNaN(Number(value))) return 'Please enter a number'
      break
    case 'dropdown':
      if (field.options && !field.options.includes(value)) return 'Please select a valid option'
      break
  }
  return null
}

export function BookingForm({ toolId, config, siteName, accentBg, accentBgHover, accentText }: BookingFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of config.fields) {
      initial[field.name] = ''
    }
    return initial
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    // Validate all fields
    const newErrors: Record<string, string> = {}
    for (const field of config.fields) {
      const error = validateField(values[field.name] || '', field)
      if (error) newErrors[field.name] = error
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/tools/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId, data: values }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Submission failed (${res.status})`)
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <ThankYou message={config.successMessage} siteName={siteName} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {config.fields.map((field) => (
        <FormField
          key={field.name}
          field={field}
          value={values[field.name] || ''}
          error={errors[field.name]}
          onChange={handleChange}
        />
      ))}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full ${accentBg} ${accentBgHover} ${accentText} font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md`}
      >
        {submitting ? 'Submitting...' : config.submitText}
      </button>
    </form>
  )
}
