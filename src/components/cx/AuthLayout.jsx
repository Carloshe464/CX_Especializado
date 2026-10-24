import { HeartHandshake } from 'lucide-react'

export default function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartHandshake className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="font-heading text-lg font-semibold">Protocolo CX</span>
        </div>
        <main className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="font-heading text-2xl font-semibold">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
          <div className="mt-6">{children}</div>
        </main>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
