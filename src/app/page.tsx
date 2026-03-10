import { LoginForm } from '@/features/auth/login-form'
import { AppShell } from '@/components/layout/app-shell'

export default function LoginPage() {
  return (
    <AppShell>
      <div className="flex min-h-dvh items-center justify-center px-4">
        <LoginForm />
      </div>
    </AppShell>
  )
}
