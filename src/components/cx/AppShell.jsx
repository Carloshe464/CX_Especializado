import { Outlet } from 'react-router-dom'

export default function AppShell() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </div>
    </main>
  )
}

