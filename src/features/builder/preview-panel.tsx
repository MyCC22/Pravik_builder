'use client'

import { Loading } from '@/components/ui/loading'

interface PreviewPanelProps {
  url: string | null
  loading?: boolean
  action?: string | null
}

function getLoadingText(action: string | null): string {
  switch (action) {
    case 'theme_changed':
      return 'Switching theme...'
    case 'edited':
    case 'removed':
    case 'reordered':
      return 'Updating...'
    default:
      return 'Generating your website...'
  }
}

export function PreviewPanel({ url, loading, action }: PreviewPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center space-y-3">
          <Loading size="lg" />
          <p className="text-gray-400 text-sm">
            {url ? 'Updating...' : getLoadingText(action ?? null)}
          </p>
        </div>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center space-y-2 px-8">
          <p className="text-4xl mb-4">&#9997;&#65039;</p>
          <p className="text-gray-300 font-medium">Describe your website</p>
          <p className="text-gray-500 text-sm">Type or use your voice below to get started</p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={url}
      className="w-full h-full border-0 bg-white"
      title="Website Preview"
      allow="clipboard-write"
    />
  )
}
