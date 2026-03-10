'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface DeployButtonProps {
  projectId: string
  disabled?: boolean
}

export function DeployButton({ projectId, disabled }: DeployButtonProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/site/${projectId}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCopy}
      disabled={disabled}
    >
      {copied ? 'Copied!' : 'Copy Link'}
    </Button>
  )
}
