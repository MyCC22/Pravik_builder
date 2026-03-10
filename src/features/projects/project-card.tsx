'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import type { Project } from '@/lib/types'

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter()

  return (
    <Card
      hoverable
      onClick={() => router.push(`/build/${project.id}`)}
    >
      <div className="aspect-video rounded-lg bg-white/5 mb-3 overflow-hidden">
        {project.preview_url ? (
          <iframe
            src={project.preview_url}
            className="w-full h-full pointer-events-none"
            title={project.name}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            No preview yet
          </div>
        )}
      </div>
      <h3 className="font-medium truncate">{project.name}</h3>
      <p className="text-sm text-gray-500 mt-1">
        {new Date(project.updated_at).toLocaleDateString()}
      </p>
    </Card>
  )
}
