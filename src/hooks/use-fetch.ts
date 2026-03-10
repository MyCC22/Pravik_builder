'use client'

import { useState, useCallback } from 'react'

interface UseFetchOptions {
  headers?: Record<string, string>
}

export function useFetch<T>(url: string, options?: UseFetchOptions) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (body?: unknown) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(url, {
          method: body ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        })

        if (!res.ok) throw new Error(`Request failed: ${res.status}`)

        const result = await res.json()
        setData(result)
        return result
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Request failed'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [url, options?.headers]
  )

  return { data, loading, error, execute }
}
