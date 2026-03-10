'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User, Session } from '@/lib/types'

interface SessionData {
  user: User
  session: Session
}

const STORAGE_KEY = 'pravik_session'

export function useSession() {
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setData(JSON.parse(stored))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (phoneNumber: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber }),
    })

    if (!res.ok) throw new Error('Login failed')

    const sessionData: SessionData = await res.json()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
    setData(sessionData)
    return sessionData
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setData(null)
  }, [])

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    loading,
    login,
    logout,
    isAuthenticated: !!data,
  }
}
