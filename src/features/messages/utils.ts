/**
 * Shared formatting utilities for caller messages.
 */

export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 1) {
      const mins = Math.floor(diffMs / (1000 * 60))
      return `${mins}m ago`
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`
    }
    if (diffHours < 48) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function formatPhone(phone: string): string {
  // Format E.164 US numbers: +15125551234 -> (512) 555-1234
  if (phone.length === 12 && phone.startsWith('+1')) {
    const digits = phone.slice(2)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}
