'use client'

import type { ToolField } from '@/services/agents/types'

interface FieldProps {
  field: ToolField
  value: string
  error?: string
  onChange: (name: string, value: string) => void
}

const baseInputClasses = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm'
const labelClasses = 'block text-sm font-medium text-slate-700 mb-1.5'
const errorClasses = 'text-xs text-red-500 mt-1'

function TextField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
        maxLength={500}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function EmailField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder || 'email@example.com'}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function PhoneField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="tel"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder || '(555) 000-0000'}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function TextareaField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className={`${baseInputClasses} resize-none ${error ? 'border-red-300 ring-red-100' : ''}`}
        maxLength={2000}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function NumberField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        className={`${baseInputClasses} ${error ? 'border-red-300 ring-red-100' : ''}`}
      />
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

function DropdownField({ field, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className={labelClasses}>
        {field.label}{field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={`${baseInputClasses} ${!value ? 'text-slate-400' : ''} ${error ? 'border-red-300 ring-red-100' : ''}`}
      >
        <option value="">Select {field.label.toLowerCase()}...</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className={errorClasses}>{error}</p>}
    </div>
  )
}

const fieldComponents: Record<string, React.ComponentType<FieldProps>> = {
  text: TextField,
  email: EmailField,
  phone: PhoneField,
  textarea: TextareaField,
  number: NumberField,
  dropdown: DropdownField,
}

export function FormField({ field, value, error, onChange }: FieldProps) {
  const Component = fieldComponents[field.type] || TextField
  return <Component field={field} value={value} error={error} onChange={onChange} />
}
