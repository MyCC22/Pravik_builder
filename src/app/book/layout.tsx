export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen" style={{ background: '#f8fafc', color: '#0f172a' }}>
      {children}
    </div>
  )
}
