'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSession } from './use-session'

export function LoginForm() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useSession()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return

    setLoading(true)
    setError('')

    try {
      await login(phone.trim())
      router.push('/projects')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Pravik Builder</h1>
        <p className="text-gray-400">Build websites with your voice</p>
      </div>

      <Input
        type="tel"
        placeholder="+1 (555) 000-0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={error}
        autoFocus
      />

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Continue
      </Button>
    </form>
  )
}
