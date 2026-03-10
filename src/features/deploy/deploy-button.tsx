'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface DeployButtonProps {
  projectId: string
  chatId: string | null
  disabled?: boolean
}

export function DeployButton({ projectId, chatId, disabled }: DeployButtonProps) {
  const [deploying, setDeploying] = useState(false)
  const [deployUrl, setDeployUrl] = useState<string | null>(null)

  const handleDeploy = async () => {
    if (!chatId) return
    setDeploying(true)

    try {
      const res = await fetch('/api/v0/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          chat_id: chatId,
          version_id: 'latest',
        }),
      })
      const { deployment } = await res.json()
      if (deployment?.url) {
        setDeployUrl(deployment.url)
      }
    } finally {
      setDeploying(false)
    }
  }

  if (deployUrl) {
    return (
      <a
        href={deployUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-green-400 underline"
      >
        Live: {deployUrl}
      </a>
    )
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleDeploy}
      loading={deploying}
      disabled={disabled || !chatId}
    >
      Deploy
    </Button>
  )
}
