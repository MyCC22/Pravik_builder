import { ProjectList } from '@/features/projects/project-list'
import { AppShell } from '@/components/layout/app-shell'

export default function ProjectsPage() {
  return (
    <AppShell>
      <div className="px-4 py-8">
        <ProjectList />
      </div>
    </AppShell>
  )
}
