'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectCard } from './project-card'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { useSession } from '@/features/auth/use-session'
import type { Project } from '@/lib/types'

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const { user } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    fetch('/api/projects', {
      headers: { 'x-user-id': user.id },
    })
      .then((res) => res.json())
      .then((data) => setProjects(data.projects || []))
      .finally(() => setLoading(false))
  }, [user])

  const createProject = async () => {
    if (!user) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const { project } = await res.json()
      router.push(`/build/${project.id}`)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loading />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <Button onClick={createProject} loading={creating}>
          + New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">No projects yet</p>
          <Button onClick={createProject} loading={creating} size="lg">
            Create your first project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
