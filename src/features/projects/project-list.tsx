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
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/messages')}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            aria-label="View messages"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </button>
          <Button onClick={createProject} loading={creating}>
            + New Project
          </Button>
        </div>
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
