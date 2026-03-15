import { AppShell } from '@/components/layout/app-shell'
import { MessagesDashboard } from '@/features/messages/messages-dashboard'

export default function MessagesPage() {
  return (
    <AppShell>
      <div className="px-4 py-8">
        <MessagesDashboard />
      </div>
    </AppShell>
  )
}
